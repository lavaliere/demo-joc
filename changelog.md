12/4/2014
--------
* Updated JOC $JENKINS_HOME files
* Updated slave agent port on JE
* Edited README.md with more info/tips
* Updated JE and JOC homes with new configs
* Changed Jenkins location configs to the host file names - will it break?

-To do:
* Fix JOC config - update to JOC 1.6 seemed to have corrupted the home
* Fix file perm problem for the workflow executor - mvn doesn't have sh execute permissions
* Finish migrating jobs from the jockey.local demo
* Need to add line in dockerfiles to edit images' host files

12/2/2014
---------
* Updated README.md with detailed instructions on the Docker demo usage and how to customize it
* Created changelog.md
* Created automated build repos for Dockerfiles for JE and JOC so they get updated to the 11.14 releases

10/28/2014
---------
* Change slave agent port number, edited security realm for JE master 

10/27/2014
---------
* Created deployment job
* Created a pipeline view

10/26/2014
---------
* Fixed configuration of the archive job

10/25/2014
---------
* Created pipeline jobs for the Wildfly project
* Edited the .gitignore for this project


10/24/2014
---------
* Forked the $JENKINS_HOME from apemberton/demo-joc
* Added embedded JBoss for Arquillian tests
