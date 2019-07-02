#
# FTP Server under Ubuntu 
#
# Author: Riccardo Bruno (INFN) <riccardo.bruno@ct.infn.it>
#
DOCKER_REPO = osct
IMAGE_NAME = ftpd
IMAGE_TAG = 0.1
FTP_USER=ftpuser

default:
	@echo "Usage: make <image|pubimg>"
	@echo "     image - Build the image: $(DOCKER_REPO)/$(IMAGE_NAME):latest"
	@echo "       run - Create container from image : $(DOCKER_REPO)/$(IMAGE_NAME):$(IMAGE_TAG)"
	@echo "             having name: $(IMAGE_NAME)_$(IMAGE_TAG)"
	@echo "   publish - Publish images: $(DOCKER_REPO)/$(IMAGE_NAME):latest"
	@echo "                             $(DOCKER_REPO)/$(IMAGE_NAME):$(IMAGE:_TAG)"
	@echo "             on the Docker-hub"
	@echo ""


image: Dockerfile
ifdef nocache
	docker build --no-cache -t $(DOCKER_REPO)/$(IMAGE_NAME):latest .
else
	docker build -t $(DOCKER_REPO)/$(IMAGE_NAME):latest .
endif
	docker tag $(DOCKER_REPO)/$(IMAGE_NAME):latest $(DOCKER_REPO)/$(IMAGE_NAME):$(IMAGE_TAG)

publish: image 
	docker push $(DOCKER_REPO)/$(IMAGE_NAME):$(IMAGE_TAG)
	docker push $(DOCKER_REPO)/$(IMAGE_NAME):latest

run:
	FTP_PASS=$$(cat /dev/random | LC_CTYPE=C tr -dc "[:alpha:]" | head -c 8) &&\
	docker run -d \
            --name $(IMAGE_NAME)_$(IMAGE_TAG)\
            -p 21:21 \
            -p 21000-21010:21000-21010 \
            -e USERS="$(FTP_USER)|$$FTP_PASS" \
            futuregateway/ftpd &&\
	echo "Credentials: $(FTP_USER)/$$FTP_PASS"
