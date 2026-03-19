FROM ohif/app:latest

# Replace OHIF config — /wado proxied to Orthanc by nginx (no CORS issue)
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# Replace nginx config with one that proxies /wado/ to Orthanc
COPY ohif-nginx-cloud.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
