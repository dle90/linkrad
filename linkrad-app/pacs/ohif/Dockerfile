FROM ohif/app:latest

# Replace the default OHIF config with our custom one
# Points WADO/QIDO directly at the Orthanc cloud URL (CORS is enabled on Orthanc)
COPY ohif-config.js /usr/share/nginx/html/app-config.js

EXPOSE 80
