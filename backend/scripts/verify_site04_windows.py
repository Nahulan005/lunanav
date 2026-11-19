"""Local bounded GIS/route checks; no network or running server."""
import math
import os
from pathlib import Path
import sys
import rasterio
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from rasterio.warp import transform
from fastapi.testclient import TestClient
from app.main import app
from app.providers.site04_coordinates import to_xy, to_lat_lon
from app.providers.site04_windows import PINS, verify_source


def main():
    crs = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m"
    geographic = "+proj=longlat +R=1737400 +no_defs"
    maximum_error = 0.0
    for lat in (-90,-89.99,-89.7668,-89.5):
        for lon in (-180,-171.87,-90,0,90,180):
            x,y = to_xy(lat,lon)
            xs,ys = transform(geographic,crs,[lon],[lat])
            maximum_error = max(maximum_error, math.hypot(xs[0]-x,ys[0]-y))
            assert math.hypot(xs[0]-x,ys[0]-y) < 1e-6
            actual_lat,actual_lon = to_lat_lon(x,y)
            assert abs(actual_lat-lat) < 1e-10
            if lat != -90:
                assert abs((actual_lon-lon+180)%360-180) < 1e-10
    # NASA Lunar Surface Data Book R04: an independent named-site sanity check,
    # not a pixel-level control point or measured registration-error estimate.
    ref_x,ref_y=to_xy(-89.7668,-171.87)
    assert abs(ref_x+1000)<5 and abs(ref_y+7000)<5
    # Direction checks guard common south-polar sign/axis mistakes.
    assert to_xy(-89,0)[1] > 0 and to_xy(-89,90)[0] > 0 and to_xy(-89,180)[1] < 0
    with TestClient(app) as client:
        footprint=client.get('/api/v1/terrain/site04/footprint').json()
        center=footprint['center']
        response=client.get('/api/v1/terrain/site04/grid',params={**center,'width':4})
        assert response.status_code == 200
        data=response.json()
        assert data['status']=='provisional',data['detail']
        assert len(data['cells'])==16 and data['selection'] is not None
        for cell in data['cells']:
            x,y=to_xy(**cell['center'])
            b=cell['bounds']
            assert abs(x-(b['min_x']+b['max_x'])/2)<1e-6
            assert abs(y-(b['min_y']+b['max_y'])/2)<1e-6
        # Another window distant from the central artifact and a clipped edge.
        for x,y in ((5000,-10000),(-8999,999)):
            lat,lon=to_lat_lon(x,y)
            remote=client.get('/api/v1/terrain/site04/grid',params=dict(latitude=lat,longitude=lon,width=3)).json()
            assert remote['status']=='provisional' and len(remote['cells'])==9
            assert remote['selection']['row'] != data['selection']['row']
            # Compare returned product values directly with the actual source cell.
            cell=remote['cells'][0]
            with rasterio.open(Path(os.environ['SITE04_DATA_DIR'])/'Site04_final_adj_5mpp_surf.tif') as ds:
                direct=ds.read(1,window=rasterio.windows.Window(cell['column'],cell['row'],1,1),masked=True)
                if direct.mask[0,0]:
                    assert cell['elevation']['value'] is None
                else:
                    assert cell['elevation']['value']==float(direct[0,0])
        outside=client.get('/api/v1/terrain/site04/grid',params=dict(latitude=20.19,longitude=30.77))
        assert outside.status_code==422 and outside.json()['detail']['code']=='OUTSIDE_SITE04_COVERAGE'
        assert client.get('/api/v1/terrain/site04/grid',params={'latitude':-89.7}).status_code==422
        assert client.get('/api/v1/terrain/site04/grid',params={**center,'width':33}).status_code==422
        with patch.dict(os.environ,{'SITE04_DATA_DIR':''}):
            assert client.get('/api/v1/terrain/site04/grid',params=center).json()['status']=='unavailable'
        with patch.dict(PINS,{'surf':'0'*64}):
            assert client.get('/api/v1/terrain/site04/grid',params=center).json()['status']=='unavailable'
        assert client.get('/api/v1/terrain/site04/grid').json()['status']=='provisional'
    print(f'PASS: 24 GDAL/PROJ comparisons (max {maximum_error:.3g} m), roundtrips, axis orientation, distinct native windows, edge clipping, 422, missing config and corrupt source fallback.')


if __name__=='__main__':
    main()
