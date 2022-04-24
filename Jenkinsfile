
node {
  def container
  def containerName = "tracksabout-api:${env.BUILD_ID}"
  def containerArgs = [
    "-e \"DB_CONNECTION_STRING=${TA_API_DB_CONNECTION_STRING}\"",
    "-e GITHUB_CLIENT_SECRET=${TA_API_GITHUB_CLIENT_SECRET}",
    "-e JWT_SIGN_PASSWORD=${TA_API_JWT_SIGN_PASSWORD}",
    "-e ADMIN_ID=${TA_API_ADMIN_ID}"
  ].join(' ')

  docker.withRegistry("http://${DOCKER_REGISTRY_URL}") {
    stage('Build') {
      git url: 'https://github.com/Amadek/tracksabout-api', branch: 'docker'
      container = docker.build(containerName)
    }

    stage('Test') {
      container.inside(containerArgs) {
        sh 'node --version'
        sh 'npm test'
      }
    }

    stage('Publish') {
      container.push()
    }
  }

  stage('Deploy') {
    try {
      sh 'docker stop tracksabout-api'
    } catch (err) { }
    sh "docker run --name tracksabout-api --rm --detach --network tracksabout-network ${containerArgs} ${DOCKER_REGISTRY_URL}/${containerName}"
  }
}
