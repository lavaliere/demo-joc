demo-joc
=========

This repo is for the $JENKINS_HOME of a complex Jenkins Operations Center Docker demo w/ High Availability, client masters, and shared slaves.

This demo features a CD pipeline for a Wildfly application, located at https://github.com/lavaliere/jenkins-cd-jboss.




Usage:
-----

To mount a shared $JENKINS_HOME for HA:

    docker run --name storage lavaliere/jenkins-storage git clone https://github.com/lavaliere/demo-joc.git .

To enable container discovery for the load balancer:
    
    docker run -d -p 172.17.42.1:53:53/udp --name skydns crosbymichael/skydns -nameserver 8.8.8.8:53 -domain beedemo.io
    docker run -d -v /var/run/docker.sock:/docker.sock --name skydock crosbymichael/skydock -ttl 30 -environment dev -s /docker.sock -domain beedemo.io -name skydns

To run JOC in an HA setup with mounted storage for its $JENKINS_HOME:

    docker run -d --dns=172.17.42.1 --name joc-1 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/joc lavaliere/jenkins-operations-center --prefix=""
    docker run -d --dns=172.17.42.1 --name joc-2 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/joc lavaliere/jenkins-operations-center --prefix=""

To run JE in an HA setup with mounted storage for its $JENKINS_HOME:

    docker run -d --dns=172.17.42.1 --name api-team-1 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/api-team lavaliere/jenkins-enterprise --prefix="/"
    docker run -d --dns=172.17.42.1 --name api-team-2 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/api-team lavaliere/jenkins-enterprise --prefix="/"

To create shared slaves:

    docker run -d --dns=172.17.42.1 --name slave-1 apemberton/jenkins-slave
    docker run -d --dns=172.17.42.1 --name slave-2 apemberton/jenkins-slave

To allow a load balancer to run in front of these containers:

    docker run -i -t --dns=172.17.42.1 -p 80:80 --name proxy lavaliere/demo-joc-haproxy  /bin/bash

Then:

    service haproxy start

To access the applications, you'll also need to edit your hosts file. On a Mac, this can be found under /private/etc/hosts. Add the following lines to this file:

    192.168.59.103  beedemo.io
    192.168.59.103  joc.beedemo.io
    192.168.59.103  jebc.beedemo.io

Where 192.168.59.103 is the ip address for boot2docker.


Optional:
---------

To expose the mounted storage volume to your local machine:
 
    docker run --rm -v /usr/local/bin/docker:/docker -v /var/run/docker.sock:/docker.sock svendowideit/samba storage

To connect to it on an Apple machine, open up finder and click on the "Go">>"Connect to Server" menu item. Then
enter your boot2docker ip address as the server address:

    cifs://192.168.59.103/

You can then use this to commit changes to your Jenkins configurations to your own fork of this repository:
    git remote set-url origin https://github.com/[your-github-id]/demo-joc.git
    git add -A
    git commit -m "committing my demo"
    git push

If deploying an artifact to Nexus:

    docker run -d -p 8081:8081 --dns=172.17.42.1 --name nexus lavaliere/nexus

Username: admin

Password: admin123

You'll also have to add this line to your hosts file:

    192.168.59.103  nexus.beedemo.io

If deploying to a Wildfly container:

    docker run --dns=172.17.42.1 -p 9990:9990  --name wildfly-1 -d lavaliere/wildfly 
    docker run --dns=172.17.42.1 -p 9991:9990 --name wildfly-2 -d lavaliere/wildfly

Username: alexis

Password: hassler

You'll also have to add this line to your hosts file:
    192.168.59.103  wildfly.beedemo.io


If running a custom setup, editing the HAproxy.cfg:

docker attach proxy
    sudo vi /etc/haproxy/haproxy.cfg
    service haproxy restart

Here is a sample HAproxy config with Nexus, Wildfly, and JE/JOC running in a highly available configuration:

    ####stock haproxy settings####
    global
    chroot      /var/lib/haproxy
    pidfile     /var/run/haproxy.pid
    maxconn     4000
    user        haproxy
    group       haproxy
    daemon
    stats socket /var/lib/haproxy/stats
    log /dev/log local0 info
    log /dev/log local0 notice
    debug

    defaults
    log                     global
    option                  dontlognull
    option                  http-server-close
    option                  forwardfor except 127.0.0.0/8
    option                  redispatch
    option                  abortonclose
    retries                 3
    maxconn                 3000
    timeout http-request    10s
    timeout queue           1m
    timeout connect         10s
    timeout client          1m
    timeout server          1m
    timeout http-keep-alive 10s
    timeout check           500
    default-server          inter 5s downinter 500 rise 1 fall 1


    frontend http_proxy *:80
    acl host hdr_dom(host) -i www.beedemo.io
    acl nex hdr_dom(host) -i nexus.beedemo.io
    acl je hdr_dom(host) -i jebc.beedemo.io
    acl joc  hdr_dom(host) -i joc.beedemo.io
    acl wild  hdr_dom(host) -i wildfly.beedemo.io
    use_backend jebc if je
    use_backend joc if joc
    use_backend wildfly if wild
    use_backend nexus if nex
    use_backend jebc if api
    use_backend joc if ops
    default_backend joc


    backend joc
    balance roundrobin
    option  httpchk /ha/health-check
    server joc1-server  joc-1.jenkins-operations-center.dev.beedemo.io:8080 check
    server joc2-server  joc-2.jenkins-operations-center.dev.beedemo.io:8080 check

    backend jebc
    balance roundrobin
    option  httpchk /api-team/ha/health-check
    server jebc1-server api-team-1.jenkins-enterprise.dev.beedemo.io:8888 check
    server jebc2-server api-team-2.jenkins-enterprise.dev.beedemo.io:8888 check

    backend wildfly
    balance roundrobin
    server wildfly1-server wildfly-1.wildfly.dev.beedemo.io:9990
    server wildfly2-server wildfly-2.wildfly.dev.beedemo.io:9990

    backend nexus
    server nexus nexus.nexus.dev.beedemo.io:8081




Tricks for working with Docker/boot2docker
-----------------------------------------

1. Using NSenter to ssh to a running container:

docker-enter + NSEnter: https://github.com/jpetazzo/nsenter

    boot2docker ssh -t sudo /var/lib/boot2docker/docker-enter "$CONTAINER_NAME"


2. If you're using a Mac, you've' restarted boot2docker and the ip address has changed, go to /etc/hosts and edit ip address to the new b2d address.

Then run 

    sudo dscacheutil -flushcache

3. To mass stop all Docker containers:

    docker stop $(docker ps -a -q)

To mass remove all stopped Docker containers:

    docker rm $(docker ps -a -q)
