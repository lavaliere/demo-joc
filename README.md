demo-joc
=========

This repo is a complex JOC demo w/HA, client masters, and shared slaves.

Usage
-----


docker run -d --name storage lavaliere/jenkins-storage git clone https://github.com/lavaliere/demo-joc.git .

docker run -d -p 172.17.42.1:53:53/udp --name skydns crosbymichael/skydns -nameserver 8.8.8.8:53 -domain beedemo.io

docker run -d -v /var/run/docker.sock:/docker.sock --name skydock crosbymichael/skydock -ttl 30 -environment dev -s /docker.sock -domain beedemo.io -name skydns

docker run -d --dns=172.17.42.1 --name joc-1 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/joc lavaliere/jenkins-operations-center --prefix="/ops-center"
docker run -d --dns=172.17.42.1 --name joc-2 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/joc lavaliere/jenkins-operations-center --prefix="/ops-center"

docker run -d --dns=172.17.42.1 --name api-team-1 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/api-team lavaliere/jenkins-enterprise --prefix="/api-team"
docker run -d --dns=172.17.42.1 --name api-team-2 --volumes-from storage -e JENKINS_HOME=/data/var/lib/jenkins/api-team lavaliere/jenkins-enterprise --prefix="/api-team"

docker run -d --dns=172.17.42.1 --name slave-1 apemberton/jenkins-slave
docker run -d --dns=172.17.42.1 --name slave-2 apemberton/jenkins-slave

docker run -i -t --dns=172.17.42.1 -p 80:80 --name proxy lavaliere/demo-joc-haproxy  /bin/bash


```
