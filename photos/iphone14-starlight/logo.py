from shapely.geometry import Point
from shapely import affinity
from shapely.ops import unary_union
def apple():
    body = unary_union([
        affinity.scale(Point(-0.24,0.10).buffer(0.36,64),1.0,1.0),
        Point(0.24,0.10).buffer(0.36,64),
        affinity.scale(Point(-0.17,-0.28).buffer(0.30,64),1.0,1.05),
        affinity.scale(Point(0.17,-0.28).buffer(0.30,64),1.0,1.05),
        Point(0,-0.05).buffer(0.42,64),
    ]).convex_hull
    body = body.difference(affinity.scale(Point(0,0.53).buffer(0.12,64),1.9,1.1))
    body = body.difference(affinity.scale(Point(0,-0.64).buffer(0.08,64),1.9,1))
    body = body.difference(Point(0.70,0.04).buffer(0.25,64))
    leaf = Point(-0.13,0).buffer(0.2,64).intersection(Point(0.13,0).buffer(0.2,64))
    leaf = affinity.rotate(affinity.scale(leaf,1.0,1.0),-45)  # lens along y -> tilt
    leaf = affinity.translate(leaf,0.05,0.66)
    return [body.simplify(0.003), leaf.simplify(0.003)]
if __name__=='__main__':
    from PIL import Image, ImageDraw
    im=Image.new('L',(400,400),255); d=ImageDraw.Draw(im)
    for g in apple():
        d.polygon([(200+x*150,200-y*150) for x,y in g.exterior.coords],fill=0)
    im.save('logo.png')
