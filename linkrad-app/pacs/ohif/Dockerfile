FROM ohif/app:v3.8.3

USER root

# Replace OHIF config
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# Nginx config template — ORTHANC_BACKEND_URL substituted at startup via entrypoint
COPY ohif-nginx.conf /etc/nginx/conf.d/default.conf.template

# Entrypoint: substitute env vars into nginx config, then start nginx
COPY docker-entrypoint-ohif.sh /usr/src/entrypoint.sh
RUN chmod +x /usr/src/entrypoint.sh

EXPOSE 80
CMD ["/usr/src/entrypoint.sh"]
