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
        // /wado is proxied to Orthanc by nginx — same origin, no CORS needed
        wadoUriRoot: window.location.origin + '/wado',
        qidoRoot: window.location.origin + '/wado',
        wadoRoot: window.location.origin + '/wado',
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
