FROM ohif/app:v3.8.3

USER root

# Replace OHIF config
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# LinkRad runtime extras (Vietnamese i18n, branding, custom tool bridges)
COPY linkrad-extras.js /usr/share/nginx/html/linkrad-extras.js

# LinkRad toolbar replacement (24-icon redesigned toolbar, modality-aware mode tabs)
COPY linkrad-toolbar.js /usr/share/nginx/html/linkrad-toolbar.js

# Inject scripts into index.html (before </body> so app code has loaded)
RUN sed -i 's|</body>|<script src="/linkrad-extras.js"></script><script src="/linkrad-toolbar.js"></script></body>|' /usr/share/nginx/html/index.html \
    && sed -i 's|<title>OHIF Viewer</title>|<title>LinkRad PACS Viewer</title>|' /usr/share/nginx/html/index.html

# Nginx config template — ORTHANC_BACKEND_URL substituted at startup via entrypoint
COPY ohif-nginx.conf /etc/nginx/conf.d/default.conf.template

# Entrypoint: substitute env vars into nginx config, then start nginx
COPY docker-entrypoint-ohif.sh /usr/src/entrypoint.sh
RUN chmod +x /usr/src/entrypoint.sh

EXPOSE 80
CMD ["/usr/src/entrypoint.sh"]
