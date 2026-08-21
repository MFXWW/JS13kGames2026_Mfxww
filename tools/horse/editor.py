import pygame
import sys
import os
import json
import time
import shutil

# ==================== 常量 ====================
FRAME_W, FRAME_H = 32, 32
CELL = 12
MARGIN = 40
PAD_TOP = 80
GAP = 12
PANEL_W = 200
PREVIEW_SCALE = 6
PREVIEW_H = 22 + FRAME_H * PREVIEW_SCALE + 30  # 标题 + 帧图 + 边距
WINDOW_W = MARGIN + FRAME_W * CELL + GAP + PANEL_W + MARGIN
WINDOW_H = PAD_TOP + FRAME_H * CELL + MARGIN + PREVIEW_H + 55

HORSE_DIR = os.path.dirname(os.path.abspath(__file__))
FRAMES_DIR = os.path.join(HORSE_DIR, 'frames')
VERSIONS_DIR = os.path.join(HORSE_DIR, 'versions')
VERSIONS_JSON = os.path.join(VERSIONS_DIR, 'versions.json')
FRAMES = ['idle', 'jumping', 'run1', 'run2', 'run3']

BLACK = (0, 0, 0)
RED = (255, 0, 0)
BG = (30, 30, 30)
PANEL = (55, 55, 55)
GRID = (85, 85, 85)
TEXT = (230, 230, 230)
SEL = (255, 200, 0)
CANVAS_BG = (40, 40, 40)
GREEN = (120, 255, 120)
ORANGE = (255, 170, 60)
DIM_WHITE = (150, 150, 150)


class PixelEditor:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_W, WINDOW_H))
        pygame.display.set_caption('Horse Frames Pixel Editor')
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont('Arial', 18)
        self.font_small = pygame.font.SysFont('Arial', 14)

        self.current_frame = 0
        self.frames = []          # [5][16][32] 每格 (r,g,b)
        self.buttons = []
        self.status = ''
        self.status_timer = 0

        self.versions = []        # [{'num','time','tag'}]
        self.current_version = -1
        self.last_commit = None   # 上次提交帧快照，用于跳过无变化提交
        self.scroll = 0
        self.version_items = []   # [(rect, num)]
        self.pending_load = None    # 待二次确认的加载版本
        self.pending_delete = None  # 待二次确认的删除版本
        self.dirty = False          # 是否有未提交改动
        # 文本输入（提交标签 / 重命名）
        self.input_active = False
        self.input_title = ''
        self.input_text = ''
        self.input_callback = None
        self.input_cancel = None

        # 动画预览状态
        self.anim = 'idle'        # idle / run / jump
        self.run_idx = 0
        self.run_interval = 0.15  # run 帧间隔（秒）
        self.run_t = 0
        self.jump_remaining = 0

        # 选区 / 剪贴板 / 粘贴
        self.sel = None            # 归一化格坐标 (x0,y0,x1,y1)
        self.sel_anchor = None
        self.sel_dragging = False
        self.moving = False
        self.move_data = None
        self.move_baseline = None
        self.move_anchor = None
        self.move_origin = None
        self.move_cur = None
        self.clipboard = None      # {'w','h','grid'}
        self.paste = None          # {'w','h','grid','pos'}
        self.paste_baseline = None
        self.mouse_cell = None

        self.load_frames()
        self.load_versions_meta()

    # ---------- 帧 / 工作区 ----------
    def load_frames(self, src_dir=FRAMES_DIR):
        self.frames = []
        for name in FRAMES:
            path = os.path.join(src_dir, name + '.png')
            img = pygame.image.load(path)
            img = pygame.transform.scale(img, (FRAME_W, FRAME_H))
            grid = []
            for y in range(FRAME_H):
                row = []
                for x in range(FRAME_W):
                    r, g, b, _ = img.get_at((x, y))
                    row.append(RED if (r > g and r > b) else BLACK)
                grid.append(row)
            self.frames.append(grid)

    def save_workspace(self):
        for i, name in enumerate(FRAMES):
            img = pygame.Surface((FRAME_W, FRAME_H))
            grid = self.frames[i]
            for y in range(FRAME_H):
                for x in range(FRAME_W):
                    img.set_at((x, y), grid[y][x])
            pygame.image.save(img, os.path.join(FRAMES_DIR, name + '.png'))

    def frames_snapshot(self):
        return [[[c for c in row] for row in grid] for grid in self.frames]

    @staticmethod
    def frames_equal(a, b):
        return a == b

    # ---------- 版本管理（git 风格） ----------
    def load_versions_meta(self):
        if os.path.exists(VERSIONS_JSON):
            with open(VERSIONS_JSON, 'r', encoding='utf-8') as f:
                self.versions = json.load(f)
            self.versions.sort(key=lambda v: v['num'])
            if self.versions:
                self.current_version = self.versions[-1]['num']

    def save_versions_meta(self):
        os.makedirs(VERSIONS_DIR, exist_ok=True)
        with open(VERSIONS_JSON, 'w', encoding='utf-8') as f:
            json.dump(self.versions, f, indent=2)

    def commit(self, tag=''):
        snap = self.frames_snapshot()
        if self.frames_equal(snap, self.last_commit):
            return None  # 内容无变化则不产生新版本
        diff = self.diff_snapshot(self.last_commit, snap) if self.last_commit is not None else {}
        self.save_workspace()
        num = max([v['num'] for v in self.versions], default=-1) + 1
        vdir = os.path.join(VERSIONS_DIR, f'v{num}')
        os.makedirs(vdir, exist_ok=True)
        for name in FRAMES:
            shutil.copyfile(os.path.join(FRAMES_DIR, name + '.png'),
                            os.path.join(vdir, name + '.png'))
        self.versions.append({'num': num, 'time': time.strftime('%H:%M:%S'), 'tag': tag, 'diff': diff})
        self.save_versions_meta()
        self.current_version = num
        self.last_commit = snap
        self.scroll = 0
        return num

    def load_version(self, num):
        if self.version_index(num) is None:
            return
        vdir = os.path.join(VERSIONS_DIR, f'v{num}')
        if not os.path.isdir(vdir):
            return
        before = self.frames_snapshot()
        self.load_frames(src_dir=vdir)
        self.save_workspace()  # 回档同时写回工作区（类似 git checkout）
        self.current_version = num
        self.last_commit = self.frames_snapshot()
        d = self.diff_snapshot(before, self.frames)
        self.pending_load = None
        self.pending_delete = None
        self.set_status(f'Reverted to v{num}: {self.format_diff(d)}')

    def version_index(self, num):
        for i, v in enumerate(self.versions):
            if v['num'] == num:
                return i
        return None

    @staticmethod
    def diff_snapshot(a, b):
        """对比两帧集，返回 {帧名: 改动像素数}"""
        d = {}
        for i, name in enumerate(FRAMES):
            cnt = 0
            for y in range(FRAME_H):
                for x in range(FRAME_W):
                    if a[i][y][x] != b[i][y][x]:
                        cnt += 1
            if cnt:
                d[name] = cnt
        return d

    @staticmethod
    def format_diff(d):
        if not d:
            return 'no changes'
        return ', '.join(f'{k}({v}px)' for k, v in d.items())

    def delete_version(self, num):
        idx = self.version_index(num)
        if idx is None:
            return
        shutil.rmtree(os.path.join(VERSIONS_DIR, f'v{num}'), ignore_errors=True)
        del self.versions[idx]
        self.save_versions_meta()
        if self.current_version == num:
            self.current_version = self.versions[-1]['num'] if self.versions else -1
            self.last_commit = None  # 工作区内容不再是已提交状态
        self.pending_delete = None
        self.pending_load = None
        self.set_status(f'Deleted v{num}')

    def start_input(self, title, initial, callback, cancel=None):
        self.input_active = True
        self.input_title = title
        self.input_text = initial
        self.input_callback = callback
        self.input_cancel = cancel
        try:
            pygame.key.start_text_input()
        except Exception:
            pass

    def finish_input(self):
        self.input_active = False
        try:
            pygame.key.stop_text_input()
        except Exception:
            pass

    def do_commit(self, tag):
        num = self.commit(tag)
        if num is None:
            self.set_status('No changes')
        else:
            diff = self.versions[self.version_index(num)]['diff']
            self.set_status(f'Committed v{num}: {self.format_diff(diff)}')

    def do_retag(self, text):
        idx = self.version_index(self.current_version)
        if idx is not None:
            self.versions[idx]['tag'] = text
            self.save_versions_meta()
            self.set_status(f'v{self.current_version} tag: {text or "(none)"}')

    def set_status(self, msg):
        self.status = msg
        self.status_timer = 150

    # ---------- 动画预览 ----------
    def render_frame(self, idx, scale):
        surf = pygame.Surface((FRAME_W * scale, FRAME_H * scale))
        grid = self.frames[idx]
        for y in range(FRAME_H):
            for x in range(FRAME_W):
                c = grid[y][x]
                if c is not None:
                    pygame.draw.rect(surf, c, (x * scale, y * scale, scale, scale))
        return surf

    def current_anim_frame(self):
        if self.anim == 'jump':
            return 1  # jumping
        if self.anim == 'run':
            return 2 + self.run_idx  # run1/run2/run3
        return 0  # idle

    def update_anim(self, dt):
        # 跳跃动画播完前保持 jump；播完立即落入 run/idle 判定
        if self.jump_remaining > 0:
            self.jump_remaining -= dt
            if self.jump_remaining > 0:
                self.anim = 'jump'
                return
            self.jump_remaining = 0
        keys = pygame.key.get_pressed()
        if keys[pygame.K_a] or keys[pygame.K_d]:
            self.anim = 'run'
            self.run_t += dt
            if self.run_t >= self.run_interval:
                self.run_t -= self.run_interval
                self.run_idx = (self.run_idx + 1) % 3
        else:
            self.anim = 'idle'
            self.run_t = 0
            self.run_idx = 0

    # ---------- 几何 ----------
    def canvas_rect(self):
        return pygame.Rect(MARGIN, PAD_TOP, FRAME_W * CELL, FRAME_H * CELL)

    def cell_from_pos(self, pos):
        rect = self.canvas_rect()
        if not rect.collidepoint(pos):
            return None
        gx = (pos[0] - rect.x) // CELL
        gy = (pos[1] - rect.y) // CELL
        if 0 <= gx < FRAME_W and 0 <= gy < FRAME_H:
            return gx, gy
        return None

    # ---------- 选区 / 剪贴板 / 粘贴 ----------
    def norm_sel(self):
        if not self.sel:
            return None
        x0, y0, x1, y1 = self.sel
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        return x0, y0, x1 - x0 + 1, y1 - y0 + 1

    def cell_in_sel(self, cell):
        r = self.norm_sel()
        if not r:
            return False
        x0, y0, w, h = r
        return x0 <= cell[0] < x0 + w and y0 <= cell[1] < y0 + h

    def copy_sel(self):
        r = self.norm_sel()
        if not r:
            self.set_status('No selection')
            return
        x0, y0, w, h = r
        grid = self.frames[self.current_frame]
        data = [[grid[y0 + dy][x0 + dx] for dx in range(w)] for dy in range(h)]
        self.clipboard = {'w': w, 'h': h, 'grid': data}
        self.set_status(f'Copied {w}x{h}')

    def start_move(self, cell):
        r = self.norm_sel()
        if not r:
            return False
        x0, y0, w, h = r
        grid = self.frames[self.current_frame]
        data = [[grid[y0 + dy][x0 + dx] for dx in range(w)] for dy in range(h)]
        self.move_data = data
        self.move_baseline = [row[:] for row in grid]
        self.move_anchor = cell
        self.move_origin = (x0, y0)
        self.move_cur = (x0, y0)
        self.moving = True
        return True

    def update_move(self, cell):
        if not self.move_data:
            return
        h = len(self.move_data)
        w = len(self.move_data[0])
        dx = cell[0] - self.move_anchor[0]
        dy = cell[1] - self.move_anchor[1]
        x0, y0 = self.move_origin
        nx = max(0, min(x0 + dx, FRAME_W - w))
        ny = max(0, min(y0 + dy, FRAME_H - h))
        self.move_cur = (nx, ny)
        grid = self.frames[self.current_frame]
        for y in range(FRAME_H):
            for x in range(FRAME_W):
                grid[y][x] = self.move_baseline[y][x]
        for dy in range(h):  # 清空源区域（剪切为背景红）
            for dx in range(w):
                grid[y0 + dy][x0 + dx] = RED
        for dy, row in enumerate(self.move_data):
            for dx, c in enumerate(row):
                grid[ny + dy][nx + dx] = c

    def commit_move(self):
        if self.move_cur:
            w, h = len(self.move_data[0]), len(self.move_data)
            x, y = self.move_cur
            self.sel = (x, y, x + w - 1, y + h - 1)
        self.moving = False
        self.move_data = self.move_baseline = None
        self.move_anchor = self.move_origin = self.move_cur = None

    def cancel_move(self):
        if self.move_baseline:
            grid = self.frames[self.current_frame]
            for y in range(FRAME_H):
                for x in range(FRAME_W):
                    grid[y][x] = self.move_baseline[y][x]
        self.moving = False
        self.move_data = self.move_baseline = None
        self.move_anchor = self.move_origin = self.move_cur = None

    def start_paste(self):
        if not self.clipboard:
            self.set_status('Clipboard is empty')
            return
        self.paste = {'w': self.clipboard['w'], 'h': self.clipboard['h'],
                      'grid': self.clipboard['grid'], 'pos': self.mouse_cell or (0, 0)}
        self.paste_baseline = [row[:] for row in self.frames[self.current_frame]]
        self.sel = None
        self.paste_update()
        self.set_status('Paste: move mouse, LMB place, Esc cancel')

    def paste_update(self):
        p = self.paste
        if not p:
            return
        nx = max(0, min(p['pos'][0], FRAME_W - p['w']))
        ny = max(0, min(p['pos'][1], FRAME_H - p['h']))
        p['pos'] = (nx, ny)
        grid = self.frames[self.current_frame]
        for y in range(FRAME_H):
            for x in range(FRAME_W):
                grid[y][x] = self.paste_baseline[y][x]
        for dy, row in enumerate(p['grid']):
            for dx, c in enumerate(row):
                grid[ny + dy][nx + dx] = c

    def commit_paste(self):
        if self.paste:
            x, y = self.paste['pos']
            self.sel = (x, y, x + self.paste['w'] - 1, y + self.paste['h'] - 1)
            self.set_status(f'Pasted {self.paste["w"]}x{self.paste["h"]}')
        self.paste = self.paste_baseline = None

    def cancel_paste(self):
        if self.paste_baseline:
            grid = self.frames[self.current_frame]
            for y in range(FRAME_H):
                for x in range(FRAME_W):
                    grid[y][x] = self.paste_baseline[y][x]
        self.paste = self.paste_baseline = None

    def cancel_active(self):
        """取消进行中的移动/粘贴（保留选区）"""
        if self.paste:
            self.cancel_paste()
        if self.moving:
            self.cancel_move()

    # ---------- 绘制 ----------
    def draw(self):
        self.screen.fill(BG)
        self.dirty = not self.frames_equal(self.frames, self.last_commit)

        # 顶部帧选择按钮
        btn_w, btn_h, gap = 96, 36, 12
        total = len(FRAMES) * btn_w + (len(FRAMES) - 1) * gap
        x0 = (WINDOW_W - total) // 2
        self.buttons = []
        for i, name in enumerate(FRAMES):
            rect = pygame.Rect(x0 + i * (btn_w + gap), 20, btn_w, btn_h)
            self.buttons.append((rect, i))
            color = SEL if i == self.current_frame else PANEL
            pygame.draw.rect(self.screen, color, rect)
            pygame.draw.rect(self.screen, GRID, rect, 1)
            label = self.font.render(name, True, TEXT)
            self.screen.blit(label, label.get_rect(center=rect.center))

        # 画布
        rect = self.canvas_rect()
        pygame.draw.rect(self.screen, CANVAS_BG, rect)
        grid = self.frames[self.current_frame]
        for gy in range(FRAME_H):
            for gx in range(FRAME_W):
                color = grid[gy][gx]
                if color is not None:
                    pygame.draw.rect(self.screen, color,
                                     (rect.x + gx * CELL, rect.y + gy * CELL, CELL, CELL))
        for gx in range(FRAME_W + 1):
            pygame.draw.line(self.screen, GRID,
                             (rect.x + gx * CELL, rect.y),
                             (rect.x + gx * CELL, rect.y + rect.height))
        for gy in range(FRAME_H + 1):
            pygame.draw.line(self.screen, GRID,
                             (rect.x, rect.y + gy * CELL),
                             (rect.x + rect.width, rect.y + gy * CELL))

        # 选区 / 移动 / 粘贴高亮
        if self.paste:
            x, y = self.paste['pos']
            pr = pygame.Rect(rect.x + x * CELL, rect.y + y * CELL,
                             self.paste['w'] * CELL, self.paste['h'] * CELL)
            pygame.draw.rect(self.screen, SEL, pr, 2)
        elif self.moving and self.move_cur and self.move_data:
            x, y = self.move_cur
            pr = pygame.Rect(rect.x + x * CELL, rect.y + y * CELL,
                             len(self.move_data[0]) * CELL, len(self.move_data) * CELL)
            ov = pygame.Surface(pr.size, pygame.SRCALPHA)
            ov.fill((255, 200, 0, 50))
            self.screen.blit(ov, pr.topleft)
            pygame.draw.rect(self.screen, SEL, pr, 2)
        elif self.sel:
            r = self.norm_sel()
            if r:
                x0, y0, w, h = r
                pr = pygame.Rect(rect.x + x0 * CELL, rect.y + y0 * CELL, w * CELL, h * CELL)
                ov = pygame.Surface(pr.size, pygame.SRCALPHA)
                ov.fill((255, 200, 0, 50))
                self.screen.blit(ov, pr.topleft)
                pygame.draw.rect(self.screen, SEL, pr, 2)

        # 版本面板
        panel = pygame.Rect(MARGIN + FRAME_W * CELL + GAP, PAD_TOP, PANEL_W, FRAME_H * CELL)
        pygame.draw.rect(self.screen, PANEL, panel)
        title = self.font_small.render('Versions', True, SEL)
        self.screen.blit(title, (panel.x + 8, panel.y + 6))
        dirty_txt = '● Modified' if self.dirty else '✓ Saved'
        d_ind = self.font_small.render(dirty_txt, True, ORANGE if self.dirty else GREEN)
        self.screen.blit(d_ind, (panel.x + panel.width - 8 - d_ind.get_width(), panel.y + 6))
        self.version_items = []
        item_h, item_gap, list_y = 24, 4, panel.y + 28
        vis_count = (panel.height - 34) // (item_h + item_gap)
        for i in range(self.scroll, min(len(self.versions), self.scroll + vis_count)):
            v = self.versions[i]
            num = v['num']
            irec = pygame.Rect(panel.x + 6, list_y, PANEL_W - 12, item_h)
            if self.pending_delete == num:
                color = (170, 60, 60)
            elif self.pending_load == num:
                color = (170, 140, 60)
            else:
                color = SEL if num == self.current_version else (75, 75, 75)
            pygame.draw.rect(self.screen, color, irec)
            pygame.draw.rect(self.screen, GRID, irec, 1)
            tag = v.get('tag', '')
            txt = f'v{num}  {tag}' if tag else f'v{num}  {v["time"]}'
            if len(txt) > 20:
                txt = txt[:19] + '…'
            label = self.font_small.render(txt, True, TEXT)
            self.screen.blit(label, (irec.x + 6, irec.y + (item_h - label.get_height()) // 2))
            if v.get('diff'):
                star = self.font_small.render('*', True, GREEN)
                self.screen.blit(star, (irec.x + PANEL_W - 20, irec.y + 3))
            self.version_items.append((irec, num))
            list_y += item_h + item_gap
        if len(self.versions) > vis_count:
            hint = self.font_small.render('(scroll to view more)', True, DIM_WHITE)
            self.screen.blit(hint, (panel.x + 8, panel.y + panel.height - 20))

        # 底部提示
        hint = self.font_small.render(
            'LMB: Draw  Shift+LMB: Select  Ctrl+C/V: Copy/Paste  S: Save  T: Tag  Del: Delete', True, TEXT)
        self.screen.blit(hint, (MARGIN, rect.y + rect.height + 12))

        # 状态提示
        if self.status and self.status_timer > 0:
            self.status_timer -= 1
            msg = self.font.render(self.status, True, GREEN)
            self.screen.blit(msg, (MARGIN, rect.y + rect.height + 30))

        # 文本输入框（提交标签 / 重命名）
        if self.input_active:
            ibox = pygame.Rect((WINDOW_W - 420) // 2, WINDOW_H - 96, 420, 64)
            pygame.draw.rect(self.screen, (70, 70, 70), ibox)
            pygame.draw.rect(self.screen, SEL, ibox, 2)
            self.screen.blit(self.font_small.render(self.input_title, True, TEXT), (ibox.x + 8, ibox.y + 5))
            self.screen.blit(self.font.render(self.input_text + '_', True, TEXT), (ibox.x + 8, ibox.y + 24))
            self.screen.blit(self.font_small.render('Enter: OK   Esc: Cancel', True, DIM_WHITE),
                             (ibox.x + 8, ibox.y + 47))

        # 动画预览区
        prev_y = rect.y + rect.height + 55
        pygame.draw.rect(self.screen, PANEL,
                         (MARGIN, prev_y, FRAME_W * PREVIEW_SCALE, PREVIEW_H - 22))
        self.screen.blit(self.font_small.render('Preview', True, SEL), (MARGIN, prev_y - 18))
        self.screen.blit(self.render_frame(self.current_anim_frame(), PREVIEW_SCALE),
                         (MARGIN, prev_y))
        info_x = MARGIN + FRAME_W * PREVIEW_SCALE + 20
        info_y = prev_y + 6
        anim_color = GREEN if self.anim == 'run' else (SEL if self.anim == 'jump' else TEXT)
        lines = [
            (f'Anim: {self.anim.upper()}', anim_color),
            (f'Run interval: {self.run_interval:.2f}s', TEXT),
            ('[ / ] : adjust run interval', DIM_WHITE),
            ('Hold A/D: run    Space: jump', DIM_WHITE),
        ]
        for text, color in lines:
            self.screen.blit(self.font_small.render(text, True, color), (info_x, info_y))
            info_y += 22

        pygame.display.flip()

    # ---------- 主循环 ----------
    def run(self):
        painting = None  # None / 'black' / 'red'
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    num = self.commit('exit')  # 退出自动保存
                    pygame.quit()
                    sys.exit()
                elif event.type == pygame.KEYDOWN:
                    if self.input_active:
                        if event.key == pygame.K_RETURN:
                            cb = self.input_callback
                            self.finish_input()
                            if cb:
                                cb(self.input_text)
                        elif event.key == pygame.K_ESCAPE:
                            cancel = self.input_cancel
                            self.finish_input()
                            if cancel:
                                cancel()
                        elif event.key == pygame.K_BACKSPACE:
                            self.input_text = self.input_text[:-1]
                        continue
                    if event.key == pygame.K_ESCAPE:
                        if self.paste:
                            self.cancel_paste()
                            self.set_status('Paste cancelled')
                        elif self.moving:
                            self.cancel_move()
                            self.set_status('Move cancelled')
                        elif self.sel:
                            self.sel = None
                            self.sel_anchor = None
                            self.sel_dragging = False
                            self.set_status('Selection cleared')
                    elif event.key == pygame.K_c and event.mod & pygame.KMOD_CTRL:
                        self.copy_sel()
                    elif event.key == pygame.K_v and event.mod & pygame.KMOD_CTRL:
                        self.start_paste()
                    elif event.key == pygame.K_s:
                        self.start_input('Commit tag (Enter=save, Esc=cancel)', '', self.do_commit)
                    elif event.key == pygame.K_t:
                        idx = self.version_index(self.current_version)
                        if idx is not None:
                            self.start_input('Rename tag for current version',
                                             self.versions[idx].get('tag', ''), self.do_retag)
                    elif event.key == pygame.K_DELETE:
                        if self.current_version >= 0:
                            if self.pending_delete == self.current_version:
                                self.delete_version(self.current_version)
                            else:
                                self.pending_delete = self.current_version
                                self.set_status(f'Press Del again to DELETE v{self.current_version}')
                    elif event.key == pygame.K_SPACE:
                        self.jump_remaining = 0.75  # 跳跃动画持续 0.75s
                    elif event.key == pygame.K_LEFTBRACKET:
                        self.run_interval = max(0.05, round(self.run_interval - 0.05, 2))
                    elif event.key == pygame.K_RIGHTBRACKET:
                        self.run_interval = min(0.50, round(self.run_interval + 0.05, 2))
                    elif pygame.K_1 <= event.key <= pygame.K_5:
                        idx = event.key - pygame.K_1
                        if idx < len(FRAMES):
                            self.cancel_active()
                            self.current_frame = idx
                elif event.type == pygame.TEXTINPUT and self.input_active:
                    if len(self.input_text) < 30:
                        self.input_text += event.text
                elif event.type == pygame.MOUSEWHEEL:
                    if len(self.versions) > 0:
                        self.scroll -= event.y
                        vis_count = (FRAME_H * CELL - 34) // 28
                        self.scroll = max(0, min(self.scroll, len(self.versions) - vis_count))
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    # 帧按钮
                    hit = False
                    for brec, i in self.buttons:
                        if brec.collidepoint(event.pos):
                            self.cancel_active()
                            self.current_frame = i
                            hit = True
                            break
                    if hit:
                        continue
                    # 版本项（左键回档 / 右键删除，有未保存改动或删除时需二次确认）
                    for vrec, num in self.version_items:
                        if vrec.collidepoint(event.pos):
                            if event.button == 1:
                                if self.dirty and self.pending_load != num:
                                    self.pending_load = num
                                    self.set_status(f'Unsaved changes: click again to revert to v{num}')
                                else:
                                    self.pending_load = None
                                    self.cancel_active()
                                    self.load_version(num)
                            elif event.button == 3:
                                if self.pending_delete == num:
                                    self.delete_version(num)
                                else:
                                    self.pending_delete = num
                                    self.set_status(f'Right-click again to DELETE v{num}')
                            hit = True
                            break
                    if hit:
                        continue
                    cell = self.cell_from_pos(event.pos)
                    if event.button == 1:
                        if self.paste:
                            if cell:
                                self.commit_paste()
                            else:
                                self.cancel_paste()
                        elif cell:
                            if pygame.key.get_mods() & pygame.KMOD_SHIFT:
                                # 框选区域
                                self.sel_anchor = cell
                                self.sel = (cell[0], cell[1], cell[0], cell[1])
                                self.sel_dragging = True
                            elif self.sel and self.cell_in_sel(cell):
                                if not self.start_move(cell):
                                    painting = 'black'
                                    self.frames[self.current_frame][cell[1]][cell[0]] = BLACK
                            else:
                                painting = 'black'
                                self.frames[self.current_frame][cell[1]][cell[0]] = BLACK
                    elif event.button == 3:
                        if self.paste:
                            self.cancel_paste()
                        elif cell:
                            painting = 'red'
                            self.frames[self.current_frame][cell[1]][cell[0]] = RED
                elif event.type == pygame.MOUSEBUTTONUP:
                    if event.button == 1:
                        if self.sel_dragging:
                            self.sel_dragging = False
                        elif self.moving:
                            self.commit_move()
                        painting = None
                    elif event.button == 3:
                        painting = None
                elif event.type == pygame.MOUSEMOTION:
                    cell = self.cell_from_pos(event.pos)
                    self.mouse_cell = cell
                    # 悬停版本项显示详情
                    if not (self.paste or self.moving or self.sel_dragging or painting):
                        for vrec, num in self.version_items:
                            if vrec.collidepoint(event.pos):
                                idx = self.version_index(num)
                                if idx is not None:
                                    v = self.versions[idx]
                                    info = f'v{v["num"]} {v["time"]} {v.get("tag", "")}'.strip()
                                    d = v.get('diff')
                                    if d:
                                        info += ' | ' + self.format_diff(d)
                                    self.set_status(info)
                                break
                    if self.paste:
                        if cell:
                            self.paste['pos'] = cell
                            self.paste_update()
                    elif self.sel_dragging:
                        if cell and self.sel_anchor:
                            self.sel = (self.sel_anchor[0], self.sel_anchor[1], cell[0], cell[1])
                    elif self.moving:
                        if cell:
                            self.update_move(cell)
                    elif painting:
                        if cell:
                            color = BLACK if painting == 'black' else RED
                            self.frames[self.current_frame][cell[1]][cell[0]] = color
            dt = self.clock.tick(60) / 1000.0
            self.update_anim(dt)
            self.draw()


if __name__ == '__main__':
    PixelEditor().run()
