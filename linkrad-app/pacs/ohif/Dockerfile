FROM ohif/app:latest

USER root

# Install envsubst (part of gettext-base)
RUN apt-get update && apt-get install -y --no-install-recommends gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Bake in the config files
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# Store nginx config as a template — entrypoint will process it
COPY ohif-nginx.conf /etc/nginx/conf.d/default.conf.template

# Startup script that runs envsubst then starts nginx
COPY docker-entrypoint-ohif.sh /docker-entrypoint-ohif.sh
RUN chmod +x /docker-entrypoint-ohif.sh

# Set at deploy time via Railway env var:
#   ORTHANC_BACKEND_URL=https://linkrad-production-2fde.up.railway.app
ENV ORTHANC_BACKEND_URL=http://orthanc:8042

EXPOSE 80

CMD ["/docker-entrypoint-ohif.sh"]
