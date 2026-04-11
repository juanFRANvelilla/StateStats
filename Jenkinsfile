pipeline {
    agent {
        docker {
            image 'gcr.io/kaniko-project/executor:debug'
            args '-u root -v $PWD:/workspace'
        }
    }
    environment {
        REGISTRY_URL = "harbor.server.local"
        IMAGE_NAME = "danielbeltejar/state-stats"
        IMAGE_TAG = "${BUILD_NUMBER}"
    }
    stages {
        stage('Build & Push Docker Image') {
            steps {
                sh """
                /kaniko/executor \
                  --context=/workspace \
                  --dockerfile=/workspace/Dockerfile \
                  --destination=${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} \
                  --destination=${REGISTRY_URL}/${IMAGE_NAME}:latest \
                  --insecure \
                  --skip-tls-verify
                """
            }
        }
    }
}
