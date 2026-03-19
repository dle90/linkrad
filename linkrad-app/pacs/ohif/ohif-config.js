window.config = {
  routerBasename: '/',
  showStudyList: true,
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'LinkRad Orthanc',
        name: 'orthanc',
        // Cloud: OHIF points directly to Orthanc (CORS is enabled on Orthanc)
        wadoUriRoot: 'https://linkrad-production-2fde.up.railway.app/wado',
        qidoRoot: 'https://linkrad-production-2fde.up.railway.app/wado',
        wadoRoot: 'https://linkrad-production-2fde.up.railway.app/wado',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        dicomUploadEnabled: true,
        omitQuotationForMultipartRequest: true,
      },
    },
  ],
  defaultDataSourceName: 'dicomweb',
};
