import bpy, bmesh, math, sys, os
from mathutils import Vector, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from logo import apple

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene

# ---------------------------------------------------------------- helpers
def srgb(c):
    return tuple(((x / 255) / 12.92 if x / 255 <= 0.04045 else ((x / 255 + 0.055) / 1.055) ** 2.4) for x in c)

def mat(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.03, sss=0.0, sheen=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    b.inputs['Subsurface Weight'].default_value = sss
    b.inputs['Sheen Weight'].default_value = sheen
    b.inputs['Specular IOR Level'].default_value = spec
    return m

def link(obj, parent=None):
    S.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

def rr_points(w, h, r, seg=14):
    pts = []
    for cx, cy, a0 in [(w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)]:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def prism(name, pts, z0, z1, mats, top=0, side=1, bottom=2, bevel=0.0, bseg=3, bmat=None, smooth_sides=True):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    f = bm.faces.new(hi); f.material_index = top
    f = bm.faces.new(list(reversed(lo))); f.material_index = bottom
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new([lo[i], lo[j], hi[j], hi[i]]); f.material_index = side
        f.smooth = smooth_sides
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    if bevel:
        md = ob.modifiers.new('bev', 'BEVEL')
        md.width = bevel; md.segments = bseg
        md.limit_method = 'ANGLE'; md.angle_limit = math.radians(40)
        md.harden_normals = True
        if bmat is not None:
            md.material = bmat
        for p in me.polygons:
            p.use_smooth = True
    return ob

def cyl(name, r, z0, z1, mats, seg=64, **kw):
    pts = [(r * math.cos(2*math.pi*i/seg), r * math.sin(2*math.pi*i/seg)) for i in range(seg)]
    return prism(name, pts, z0, z1, mats, **kw)

def box(name, sx, sy, sz, loc, m, bevel=0.0, seg=3, rot=(0, 0, 0)):
    pts = [(-sx/2, -sy/2), (sx/2, -sy/2), (sx/2, sy/2), (-sx/2, sy/2)]
    ob = prism(name, pts, -sz/2, sz/2, [m], 0, 0, 0, bevel=bevel, bseg=seg, smooth_sides=False)
    ob.location = loc; ob.rotation_euler = rot
    return link(ob)

def lathe(name, profile, m, seg=96, loc=(0, 0, 0)):
    """profile: list of (r, z) from outer bottom around to inner; revolved around Z."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(len(profile) - 1):
            f = bm.faces.new([rings[i][k], rings[j][k], rings[j][k+1], rings[i][k+1]])
            f.smooth = True
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    return link(ob)

def noise_bump(m, scale, strength, dist=0.001, detail=8):
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = dist
    nt.links.new(n.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

# ---------------------------------------------------------------- materials
M = {}
M['back'] = mat('back_glass', srgb((236, 229, 219)), rough=0.22, coat=1.0, coat_rough=0.02, sss=0.0)
M['frame'] = mat('frame_alu', srgb((222, 212, 198)), rough=0.28, metal=1.0)
M['screen'] = mat('screen', srgb((8, 8, 10)), rough=0.03, coat=1.0)
M['lensglass'] = mat('lens_glass', (1, 1, 1), rough=0.0)
M['lensglass'].node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value = 1.0
M['iris'] = mat('iris', srgb((70, 72, 80)), rough=0.25, metal=1.0)
M['pupil'] = mat('pupil', srgb((14, 16, 30)), rough=0.02, coat=1.0)
M['lensring'] = mat('lens_ring', srgb((228, 220, 208)), rough=0.12, metal=1.0)
M['lensinner'] = mat('lens_inner', srgb((12, 12, 14)), rough=0.5)
M['flash'] = mat('flash', srgb((238, 232, 214)), rough=0.15, coat=1.0)
M['logo'] = mat('logo', srgb((214, 204, 192)), rough=0.08, metal=1.0)
M['mic'] = mat('mic', srgb((30, 30, 30)), rough=0.6)

# ---------------------------------------------------------------- iPhone 14 (Starlight), lying back-up
W, H, T = 0.0715, 0.1467, 0.0078
phone = bpy.data.objects.new('iPhone', None); link(phone)
body = prism('body', rr_points(W, H, 0.0102, 16), 0.0, T,
             [M['back'], M['frame'], M['screen']], top=0, side=1, bottom=2,
             bevel=0.0007, bseg=4, bmat=1)
link(body, phone)

inset, bs = 0.0024, 0.0316
bx, by = -W/2 + inset + bs/2, H/2 - inset - bs/2
bump = prism('bump', rr_points(bs, bs, 0.0072, 12), T - 0.0002, T + 0.0013,
             [M['back'], M['back'], M['back']], bevel=0.0005, bseg=3)
bump.location = (bx, by, 0); link(bump, phone)

x0, y0 = -W/2, H/2
def lens(px, py):
    cx, cy = x0 + px, y0 - py
    ring = lathe('ring', [(0.0064, T + 0.0010), (0.0064, T + 0.0027), (0.00625, T + 0.00295), (0.0060, T + 0.0031),
                          (0.0055, T + 0.0031), (0.0053, T + 0.0029), (0.0053, T + 0.0012)], M['lensring'], loc=(cx, cy, 0))
    ring.parent = phone
    inner = cyl('inner', 0.0053, T + 0.0012, T + 0.0020, [M['lensinner'], M['lensinner'], M['lensinner']])
    inner.location = (cx, cy, 0); link(inner, phone)
    glass = cyl('glass', 0.0053, T + 0.00285, T + 0.0031, [M['lensglass']] * 3)
    glass.location = (cx, cy, 0); link(glass, phone)
    iris = cyl('iris', 0.0031, T + 0.00200, T + 0.00212, [M['iris']] * 3)
    iris.location = (cx, cy, 0); link(iris, phone)
    pupil = cyl('pupil', 0.0019, T + 0.00200, T + 0.00218, [M['pupil']] * 3, bevel=0.0001, bseg=3)
    pupil.location = (cx, cy, 0); link(pupil, phone)
lens(0.0102, 0.0102)
lens(0.0261, 0.0261)
fl = cyl('flash', 0.0027, T + 0.0010, T + 0.00135, [M['flash'], M['lensring'], M['flash']], bevel=0.0001, bseg=2)
fl.location = (x0 + 0.0263, y0 - 0.0100, 0); link(fl, phone)
mic = cyl('mic', 0.0006, T + 0.0010, T + 0.00132, [M['mic']] * 3, seg=16)
mic.location = (x0 + 0.0100, y0 - 0.0263, 0); link(mic, phone)

# apple logo (glossy, colour-matched)
LH = 0.0142
for i, g in enumerate(apple()):
    pts = [(x * LH, y * LH) for x, y in list(g.exterior.coords)[:-1]]
    if g.exterior.is_ccw is False:
        pts = pts[::-1]
    lg = prism('logo%d' % i, pts, T - 0.00005, T + 0.00003, [M['logo']] * 3, smooth_sides=False)
    lg.location = (0, 0.0005, 0); link(lg, phone)

# side buttons
def side_btn(x, y, length, sign):
    b = box('btn', 0.0012, length, 0.0034, (x + sign * 0.0006, y, T / 2), M['frame'], bevel=0.0005, seg=3)
    b.parent = phone
side_btn(-W/2, 0.030, 0.0105, -1)   # volume up
side_btn(-W/2, 0.016, 0.0105, -1)   # volume down
side_btn(-W/2, 0.047, 0.0055, -1)   # ring switch
side_btn(W/2, 0.024, 0.0165, 1)     # power

# ---------------------------------------------------------------- interior
TABLE_Z = 0.40
trav = bpy.data.materials.new('travertine'); trav.use_nodes = True
nt = trav.node_tree; bsdf = nt.nodes['Principled BSDF']
tc = nt.nodes.new('ShaderNodeTexCoord')
mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(8))
nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'
wv.inputs['Scale'].default_value = 7.0; wv.inputs['Distortion'].default_value = 2.2
wv.inputs['Detail'].default_value = 8; wv.inputs['Detail Scale'].default_value = 2.5
nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 25; nz.inputs['Detail'].default_value = 10
nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'
mix.inputs[1].default_value = 0.35
nt.links.new(wv.outputs['Fac'], mix.inputs[0]); nt.links.new(nz.outputs['Fac'], mix.inputs[2])
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = 0.25; ramp.color_ramp.elements[0].color = (*srgb((205, 185, 158)), 1)
ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (*srgb((232, 219, 199)), 1)
e = ramp.color_ramp.elements.new(0.5); e.color = (*srgb((221, 204, 180)), 1)
nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 140
nt.links.new(mp.outputs['Vector'], vor.inputs['Vector'])
pr = nt.nodes.new('ShaderNodeMapRange'); pr.inputs['From Min'].default_value = 0.0; pr.inputs['From Max'].default_value = 0.12
nt.links.new(vor.outputs['Distance'], pr.inputs['Value'])
bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25; bp.inputs['Distance'].default_value = 0.0005
nt.links.new(pr.outputs['Result'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.38
bsdf.inputs['Subsurface Weight'].default_value = 0.05
table = box('table_top', 1.30, 0.72, 0.045, (0, 0.05, TABLE_Z - 0.0225), trav, bevel=0.006, seg=4)
box('table_base', 0.9, 0.42, TABLE_Z - 0.045, (0, 0.05, (TABLE_Z - 0.045) / 2), trav, bevel=0.004)

plaster = noise_bump(mat('plaster', srgb((236, 230, 220)), rough=0.85), 60, 0.08)
oak = bpy.data.materials.new('oak_floor'); oak.use_nodes = True
nt = oak.node_tree; b = nt.nodes['Principled BSDF']
wv = nt.nodes.new('ShaderNodeTexWave'); wv.bands_direction = 'X'
wv.inputs['Scale'].default_value = 3; wv.inputs['Distortion'].default_value = 12; wv.inputs['Detail'].default_value = 4
ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (*srgb((150, 118, 86)), 1); ramp.color_ramp.elements[1].color = (*srgb((190, 158, 122)), 1)
nt.links.new(wv.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
b.inputs['Roughness'].default_value = 0.45

# room: x -2.2..2.6, y -3..2.6, z 0..2.9 ; window opening in left wall (x = -2.2)
box('floor', 5.2, 6.0, 0.02, (0.2, -0.2, -0.01), oak)
box('ceiling', 5.2, 6.0, 0.02, (0.2, -0.2, 2.91), plaster)
box('wall_back', 5.2, 0.1, 2.9, (0.2, 2.65, 1.45), plaster)
box('wall_front', 5.2, 0.1, 2.9, (0.2, -3.25, 1.45), plaster)
box('wall_right', 0.1, 6.0, 2.9, (2.65, -0.2, 1.45), plaster)
# left wall with a tall window from y=-1.6..1.4, z=0.25..2.6
WX = -2.25
box('wl_a', 0.1, 1.4, 2.9, (WX, -2.5, 1.45), plaster)
box('wl_b', 0.1, 1.2, 2.9, (WX, 2.0, 1.45), plaster)
box('wl_c', 0.1, 3.0, 0.25, (WX, -0.1, 0.125), plaster)
box('wl_d', 0.1, 3.0, 0.30, (WX, -0.1, 2.75), plaster)
frame_m = mat('window_frame', srgb((60, 58, 55)), rough=0.4, metal=0.5)
for yy in (-1.6, -0.6, 0.4, 1.4):
    box('mullion', 0.06, 0.05, 2.35, (WX, yy, 1.425), frame_m)
for zz in (0.25, 1.55, 2.6):
    box('transom', 0.06, 3.0, 0.05, (WX, -0.1, zz), frame_m)

# rug
rug = noise_bump(mat('rug', srgb((214, 203, 186)), rough=0.95, sheen=0.6), 300, 0.4)
box('rug', 2.8, 2.2, 0.012, (0.0, 0.5, 0.006), rug, bevel=0.004)

# boucle sofa behind the table
boucle = mat('boucle', srgb((238, 233, 224)), rough=0.95, sheen=1.0)
nt = boucle.node_tree; b = nt.nodes['Principled BSDF']
vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 400
bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6; bp.inputs['Distance'].default_value = 0.002
nt.links.new(vo.outputs['Distance'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
SY = 1.55
box('sofa_base', 2.5, 1.0, 0.22, (0, SY, 0.13), boucle, bevel=0.06, seg=6)
for sx in (-0.62, 0.62):
    box('sofa_seat', 1.22, 0.85, 0.20, (sx, SY - 0.05, 0.33), boucle, bevel=0.08, seg=8)
box('sofa_back', 2.5, 0.28, 0.55, (0, SY + 0.40, 0.55), boucle, bevel=0.12, seg=8)
for sx in (-1.3, 1.3):
    box('sofa_arm', 0.28, 1.0, 0.42, (sx, SY, 0.40), boucle, bevel=0.12, seg=8)
linen = mat('linen_pillow', srgb((196, 176, 150)), rough=0.9, sheen=0.8)
box('pillow', 0.5, 0.16, 0.42, (-0.75, SY + 0.18, 0.62), linen, bevel=0.07, seg=8, rot=(math.radians(-12), 0, math.radians(6)))
box('pillow2', 0.46, 0.15, 0.40, (0.85, SY + 0.2, 0.61), boucle, bevel=0.07, seg=8, rot=(math.radians(-12), 0, math.radians(-8)))

# large ceramic floor vase with dry branches (right corner)
ceram = noise_bump(mat('ceramic_sand', srgb((196, 170, 140)), rough=0.7), 90, 0.15)
lathe('floor_vase', [(0.001, 0.0), (0.16, 0.0), (0.22, 0.18), (0.21, 0.40), (0.12, 0.62), (0.08, 0.70), (0.09, 0.74), (0.07, 0.74), (0.06, 0.70), (0.001, 0.70)], ceram, loc=(1.75, 1.9, 0))
twig = mat('twig', srgb((70, 55, 40)), rough=0.8)
import random
random.seed(4)
for i in range(9):
    L = random.uniform(0.7, 1.3)
    t = cyl('twig', 0.006, 0, L, [twig] * 3, seg=8)
    t.location = (1.75, 1.9, 0.68)
    t.rotation_euler = (random.uniform(-0.45, 0.45), random.uniform(-0.45, 0.45), 0)
    link(t)

# sheer curtain pulled to the side of the window
curt = bpy.data.materials.new('sheer'); curt.use_nodes = True
nt = curt.node_tree; b = nt.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (*srgb((240, 236, 228)), 1)
b.inputs['Roughness'].default_value = 0.9
b.inputs['Transmission Weight'].default_value = 0.6
b.inputs['Alpha'].default_value = 0.8
me = bpy.data.meshes.new('curtain'); bm = bmesh.new()
cols, rows = 60, 20
grid = []
for r in range(rows + 1):
    z = 0.02 + 2.8 * r / rows
    row = []
    for c in range(cols + 1):
        y = 1.0 + 0.9 * c / cols
        x = WX + 0.12 + 0.035 * math.sin(c / cols * 2 * math.pi * 7)
        row.append(bm.verts.new((x, y, z)))
    grid.append(row)
for r in range(rows):
    for c in range(cols):
        f = bm.faces.new([grid[r][c], grid[r][c+1], grid[r+1][c+1], grid[r+1][c]]); f.smooth = True
bm.to_mesh(me); bm.free(); me.materials.append(curt)
link(bpy.data.objects.new('curtain', me))

# ---------------------------------------------------------------- props on the table
stone = mat('stone_ceramic', srgb((58, 56, 52)), rough=0.75)
noise_bump(stone, 120, 0.12)
# low ceramic mug + saucer
lathe('mug', [(0.001, 0.0), (0.036, 0.0), (0.041, 0.006), (0.043, 0.075), (0.040, 0.078), (0.038, 0.074), (0.037, 0.012), (0.001, 0.012)],
      stone, loc=(0.28, 0.16, TABLE_Z + 0.006))
coffee = mat('coffee', srgb((40, 24, 14)), rough=0.05)
cyl('coffee', 0.0372, 0, 0.001, [coffee] * 3).location = (0.28, 0.16, TABLE_Z + 0.006 + 0.058)
link(bpy.data.objects['coffee'])
lathe('saucer', [(0.001, 0.0), (0.050, 0.0), (0.072, 0.006), (0.075, 0.009), (0.070, 0.009), (0.050, 0.004), (0.001, 0.004)],
      stone, loc=(0.28, 0.16, TABLE_Z))
# stacked coffee-table books
cloth_g = mat('book_green', srgb((52, 66, 56)), rough=0.8, sheen=0.3)
cloth_c = mat('book_sand', srgb((200, 184, 160)), rough=0.8, sheen=0.3)
paper = mat('paper', srgb((236, 230, 218)), rough=0.9)
box('book1', 0.30, 0.235, 0.028, (-0.34, 0.14, TABLE_Z + 0.014), cloth_g, bevel=0.002, rot=(0, 0, math.radians(-4)))
box('book1p', 0.292, 0.228, 0.024, (-0.338, 0.14, TABLE_Z + 0.014), paper, rot=(0, 0, math.radians(-4)))
box('book2', 0.25, 0.19, 0.022, (-0.33, 0.13, TABLE_Z + 0.028 + 0.011), cloth_c, bevel=0.002, rot=(0, 0, math.radians(7)))
# small sculptural vase on the books
white_cer = noise_bump(mat('white_ceramic', srgb((232, 226, 216)), rough=0.55), 150, 0.1)
lathe('small_vase', [(0.001, 0.0), (0.045, 0.0), (0.060, 0.05), (0.055, 0.11), (0.025, 0.16), (0.022, 0.19), (0.026, 0.195), (0.018, 0.195), (0.016, 0.17), (0.001, 0.17)],
      white_cer, loc=(-0.36, 0.15, TABLE_Z + 0.05))
# a single dry stem in the vase
st = cyl('stem', 0.002, 0, 0.32, [twig] * 3, seg=8); st.location = (-0.36, 0.15, TABLE_Z + 0.2)
st.rotation_euler = (0.25, -0.2, 0); link(st)

# phone placement
phone.location = (0.02, -0.06, TABLE_Z)
phone.rotation_euler = (0, 0, math.radians(-22))

# ---------------------------------------------------------------- light
sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 6.0; sun_d.angle = math.radians(1.2)
sun_d.color = (1.0, 0.93, 0.82)
sun = link(bpy.data.objects.new('sun', sun_d))
sun.rotation_euler = Euler((math.radians(58), 0, math.radians(-78)), 'XYZ')
# sky light coming through the window
portal_d = bpy.data.lights.new('sky', 'AREA'); portal_d.shape = 'RECTANGLE'
portal_d.size = 3.0; portal_d.size_y = 2.4; portal_d.energy = 260; portal_d.color = (0.86, 0.92, 1.0)
portal = link(bpy.data.objects.new('sky', portal_d))
portal.location = (WX - 0.2, -0.1, 1.4); portal.rotation_euler = (0, math.radians(90), 0)
fill_d = bpy.data.lights.new('fill', 'AREA'); fill_d.size = 1.5; fill_d.energy = 25; fill_d.color = (1.0, 0.95, 0.9)
fill = link(bpy.data.objects.new('fill', fill_d)); fill.location = (0.8, -2.2, 2.4)
fill.rotation_euler = (math.radians(55), 0, math.radians(20))

world = bpy.data.worlds.new('world'); S.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.84, 1.0, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9

# ---------------------------------------------------------------- cameras
focus = bpy.data.objects.new('focus', None); link(focus)
def camera(name, loc, target, lens, fstop, focus_pt):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    f = bpy.data.objects.new(name + '_f', None); f.location = focus_pt; link(f)
    cd.dof.focus_object = f
    c = link(bpy.data.objects.new(name, cd)); c.location = loc
    d = Vector(target) - Vector(loc)
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return c

P = phone.location
cams = {
    'hero': camera('hero', (0.13, -0.33, TABLE_Z + 0.21), (0.0, 0.0, TABLE_Z + 0.0), 50, 2.8, (0.02, -0.06, TABLE_Z + 0.006)),
    'low': camera('low', (0.17, -0.30, TABLE_Z + 0.07), (0.0, -0.03, TABLE_Z + 0.02), 70, 4.0, (0.02, -0.06, TABLE_Z + 0.006)),
    'top': camera('top', (-0.02, 0.0, TABLE_Z + 0.62), (-0.02, 0.0, TABLE_Z), 38, 8.0, (0, 0.0, TABLE_Z)),
    'detail': camera('detail', (0.10, -0.13, TABLE_Z + 0.11), (0.018, 0.0, TABLE_Z + 0.008), 100, 9.0, (0.0224, -0.0013, TABLE_Z + 0.009)),
}
cams['top'].rotation_euler = (0, 0, math.radians(0))

# ---------------------------------------------------------------- render settings
S.render.engine = 'CYCLES'
S.cycles.device = 'CPU'
S.cycles.use_denoising = True
S.cycles.max_bounces = 8
S.cycles.caustics_reflective = False; S.cycles.caustics_refractive = False
S.view_settings.view_transform = 'AgX'
try:
    S.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
S.view_settings.exposure = float(os.environ.get('EXPO', '0.0'))
S.render.image_settings.file_format = 'JPEG'
S.render.image_settings.quality = 94

which = os.environ.get('SHOTS', 'hero').split(',')
res = os.environ.get('RES', '800x1000').split('x')
S.cycles.samples = int(os.environ.get('SAMPLES', '64'))
out = os.environ.get('OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'r'))
for name in which:
    S.camera = cams[name]
    S.render.resolution_x, S.render.resolution_y = int(res[0]), int(res[1])
    if name in ('low',):
        S.render.resolution_x, S.render.resolution_y = int(res[1]), int(res[0])
    S.render.filepath = os.path.join(out, name + '.jpg')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)
