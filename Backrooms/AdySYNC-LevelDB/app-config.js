window.MapConfig = Object.freeze({
    levels: Object.freeze({
        initialId: '0',
        available: Object.freeze([
            Object.freeze({ id: '0', label: 'Level 0' }),
            Object.freeze({ id: '0.5', label: 'Level 0.5', parent: '0' }),
            Object.freeze({ id: '1', label: 'Level 1' }),
            Object.freeze({ id: '1.1', label: 'Level 1.1', parent: '1' })
        ])
    }),
    map: Object.freeze({
        defaultLimit: 1e9,
        fallbackViewportSize: 800,
        fallbackStudsPerPixel: 10,
        initialZoomStuds: 20000,
        minStudsPerPixel: 0.05,
        maxStudsPerPixel: 4e6,
        zoomFactor: 1.2,
        minimumWallDistance: 500,
        initialZoomPadding: 2.4,
        maximumZoomPadding: 2.2
    }),
    grid: Object.freeze({
        maxVisibleStuds: 2e7,
        sectorViewMinStuds: 5e5,
        sectorViewMaxStuds: 2e7,
        sectorSize: 2e6,
        regularLineSpacingStuds: 120,
        maxLinesPerAxis: 500,
        sectorOffset: 0.5,
        dynamicLabelTargetPixels: 160,
        labelEdgePadding: 25,
        maxVisibleSectors: 400
    }),
    rendering: Object.freeze({
        wallWidth: 3,
        wallLineCap: 'round',
        wallLineJoin: 'round',
        defaultWallColor: '#4378c9',
        markerShapes: Object.freeze(['circle', 'square', 'diamond', 'triangle', 'star', 'hexagon'])
    }),
    layers: Object.freeze({
        visibility: Object.freeze([
            Object.freeze({ id: 'default', maxVisStuds: Infinity }),
            Object.freeze({ id: 'walls', maxVisStuds: Infinity }),
            Object.freeze({ id: 'overview', maxVisStuds: Infinity }),
            Object.freeze({ id: 'regional', maxVisStuds: 2e7 }),
            Object.freeze({ id: 'detail', maxVisStuds: 1e5 }),
            Object.freeze({ id: 'sectors', maxVisStuds: 2e7 }),
            Object.freeze({ id: 'border', maxVisStuds: 2e7 }),
            Object.freeze({ id: 'grid', maxVisStuds: Infinity })
        ]),
        legacyNumericIds: Object.freeze({ 0: 'detail', 1: 'regional', 2: 'overview' })
    })
});
