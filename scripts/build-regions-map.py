"""Create the five-region vector outline from Natural Earth admin-1 data.

Source: Natural Earth 1:10m states/provinces (public domain).
The source GeoJSON is an input argument; it is not required at runtime.
"""
import json, math, sys
from pathlib import Path

source=Path(sys.argv[1]); dest=Path(__file__).resolve().parents[1]/'assets/map-five-regions.svg'
ids=['RU-KLU','RU-RYA','RU-ORL','RU-LIP','RU-TUL']
geo={x['properties'].get('iso_3166_2'):x['geometry'] for x in json.loads(source.read_text())['features'] if x['properties'].get('iso_3166_2') in ids}
def rings(g):return [g['coordinates'][0]] if g['type']=='Polygon' else [part[0] for part in g['coordinates']]
def project(p):return (p[0]*math.cos(math.radians(54)),-p[1])
all_points=[project(p) for g in geo.values() for ring in rings(g) for p in ring]
minx,maxx=min(p[0] for p in all_points),max(p[0] for p in all_points)
miny,maxy=min(p[1] for p in all_points),max(p[1] for p in all_points)
scale=min(700/(maxx-minx),460/(maxy-miny)); ox=(760-(maxx-minx)*scale)/2;oy=(520-(maxy-miny)*scale)/2
def point(p):
 x,y=project(p);return (ox+(x-minx)*scale,oy+(y-miny)*scale)
def simplify(points,tol=1.0):
 if len(points)<3:return points
 a,b=points[0],points[-1]; dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
 dist=lambda p:math.hypot(p[0]-a[0],p[1]-a[1]) if not den else math.hypot(p[0]-(a[0]+max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den))*dx),p[1]-(a[1]+max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den))*dy))
 i=max(range(1,len(points)-1),key=lambda j:dist(points[j])); d=dist(points[i])
 return simplify(points[:i+1],tol)[:-1]+simplify(points[i:],tol) if d>tol else [a,b]
paths=[]
for region in ids:
 for ring in rings(geo[region]):
  pp=simplify([point(p) for p in ring]); path='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in pp)+' Z'
  klass='tula' if region=='RU-TUL' else 'region'
  paths.append(f'<path class="{klass}" d="{path}"/>')
svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 520" role="img" aria-label="Контуры Тульской, Рязанской, Калужской, Орловской и Липецкой областей">
<style>.region{fill:#303332;stroke:#858985;stroke-width:2;stroke-linejoin:round}.tula{fill:#40391f;stroke:#ffc800;stroke-width:3;stroke-linejoin:round}</style>
'''+''.join(paths)+'</svg>\n'
dest.write_text(svg)
print(dest,len(svg))
