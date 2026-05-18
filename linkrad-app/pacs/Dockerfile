# Pinned by digest to prevent silent upgrades on Railway rebuilds. Previously
# this was `:latest`, which drifted to 1.12.11 on prod while local stayed on
# 1.12.10. Pinning to the digest local has validated keeps prod predictable.
# Update the digest when you want to upgrade — and test the new version
# locally first (`docker pull orthancteam/orthanc:latest && docker inspect ...`).
FROM orthancteam/orthanc@sha256:a055ccd31f7cd1e45ce98912e1c6e8e83b6a8f262f5b8fe6c88e2b6cd060fc57

# Tell Railway which port to route HTTP traffic to
ENV ORTHANC__HTTP_PORT=8042
EXPOSE 8042
