import pygame
import sys
import json
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict

# 初始化 Pygame
pygame.init()

# 常量定义
MAP_WIDTH = 32
MAP_HEIGHT = 16
DEFAULT_TILE_SIZE = 24
WINDOW_WIDTH = MAP_WIDTH * DEFAULT_TILE_SIZE + 400  # 右侧面板宽度
WINDOW_HEIGHT = max(MAP_HEIGHT * DEFAULT_TILE_SIZE, 600)

# 颜色定义
COLORS = {
    "bg": (248, 250, 252),
    "panel_bg": (255, 255, 255),
    "tile_empty": (245, 245, 245),
    "tile_solid": (51, 51, 51),
    "grid": (0, 0, 0, 8),
    "hover_instr": (102, 178, 255),
    "selected_instr": (240, 192, 0),
    "mouse_tile": (0, 128, 255, 12),
    "mouse_tile_border": (0, 128, 255, 153),
    "drag_solid": (0, 200, 64, 12),
    "drag_solid_border": (0, 200, 64, 204),
    "drag_empty": (255, 100, 100, 12),
    "drag_empty_border": (255, 60, 60, 204),
    "text": (30, 41, 59),
    "primary": (59, 130, 246),
    "secondary": (100, 116, 139),
    "red": (239, 68, 68),
    "panel_shadow": (0, 0, 0, 8),
}

# 指令数据类
@dataclass
class Instruction:
    type: str  # '0' 空, '1' 实心
    startX: int
    startY: int
    endX: int
    endY: int

# 主编辑器类
class LevelEditor:
    def __init__(self):
        # 窗口设置
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption("Level Editor (Pygame)")
        self.clock = pygame.time.Clock()
        
        # 字体
        self.font_small = pygame.font.SysFont("Arial", 12)
        self.font_normal = pygame.font.SysFont("Arial", 14)
        self.font_bold = pygame.font.SysFont("Arial", 14, bold=True)
        
        # 状态变量
        self.tile_size = DEFAULT_TILE_SIZE
        self.map_data = {
            "base": "0",
            "instructions": [
                Instruction(type='1', startX=2, startY=4, endX=10, endY=6),
                Instruction(type='1', startX=0, startY=14, endX=31, endY=15)
            ]
        }
        self.map_array = []
        self.mouse_tile = {"x": -1, "y": -1}
        self.selected_instruction_index = -1
        self.hovered_instruction_index = -1
        self.is_dragging = False
        self.drag_start = None
        self.drag_current = None
        self.was_dragging = False
        self.drag_draw_type = '1'
        
        # UI 状态
        self.inputs = {
            "base_select": "0",
            "tile_size_input": str(DEFAULT_TILE_SIZE),
            "type_select": "1",
            "startX": "0",
            "startY": "0",
            "endX": "0",
            "endY": "0",
            "active_input": None  # 当前激活的输入框
        }
        
        # 初始化UI元素位置（动态计算）
        self.update_ui_positions()
        
        # 初始化地图数组
        self.generate_map_array()

    def update_ui_positions(self):
        """更新UI元素位置（瓦片尺寸变化时调用）"""
        panel_x = MAP_WIDTH * self.tile_size
        
        # 按钮位置
        self.buttons = {
            "new": pygame.Rect(panel_x + 20, 20, 80, 36),
            "import_json": pygame.Rect(panel_x + 110, 20, 100, 36),
            "import_str": pygame.Rect(panel_x + 220, 20, 100, 36),
            "export_json": pygame.Rect(panel_x + 20, 70, 100, 36),
            "copy_str": pygame.Rect(panel_x + 130, 70, 100, 36),
        }
        
        # 输入框位置
        self.input_rects = {
            "base_select": pygame.Rect(panel_x + 100, 130, 80, 30),
            "tile_size_input": pygame.Rect(panel_x + 100, 170, 80, 30),
        }

    def clamp_coord(self, x: int, y: int) -> Tuple[int, int]:
        """限制坐标在地图范围内"""
        x = max(0, min(MAP_WIDTH - 1, int(x)))
        y = max(0, min(MAP_HEIGHT - 1, int(y)))
        return x, y

    def generate_map_array(self):
        """根据base和指令生成地图数组"""
        self.map_array = []
        # 初始化base
        for y in range(MAP_HEIGHT):
            row = [self.map_data["base"] for _ in range(MAP_WIDTH)]
            self.map_array.append(row)
        
        # 应用指令
        for instr in self.map_data["instructions"]:
            for y in range(instr.startY, instr.endY + 1):
                for x in range(instr.startX, instr.endX + 1):
                    if 0 <= x < MAP_WIDTH and 0 <= y < MAP_HEIGHT:
                        self.map_array[y][x] = instr.type

    def render(self):
        """渲染所有内容"""
        # 清空背景
        self.screen.fill(COLORS["bg"])
        
        # 绘制地图区域
        self.draw_map()
        
        # 绘制右侧面板
        self.draw_side_panel()
        
        # 更新显示
        pygame.display.flip()

    def draw_map(self):
        """绘制地图和相关元素"""
        # 调整画布大小
        canvas_width = MAP_WIDTH * self.tile_size
        canvas_height = MAP_HEIGHT * self.tile_size
        
        # 绘制瓦片
        for y in range(MAP_HEIGHT):
            for x in range(MAP_WIDTH):
                tile_value = self.map_array[y][x]
                color = COLORS["tile_solid"] if tile_value == '1' else COLORS["tile_empty"]
                rect = pygame.Rect(
                    x * self.tile_size,
                    y * self.tile_size,
                    self.tile_size,
                    self.tile_size
                )
                pygame.draw.rect(self.screen, color, rect)
        
        # 绘制网格
        pygame.draw.rect(self.screen, COLORS["grid"], (0, 0, canvas_width, canvas_height), 1)
        for x in range(1, MAP_WIDTH):
            pygame.draw.line(
                self.screen, COLORS["grid"],
                (x * self.tile_size, 0),
                (x * self.tile_size, canvas_height),
                1
            )
        for y in range(1, MAP_HEIGHT):
            pygame.draw.line(
                self.screen, COLORS["grid"],
                (0, y * self.tile_size),
                (canvas_width, y * self.tile_size),
                1
            )
        
        # 鼠标悬浮瓦片高亮
        if self.mouse_tile["x"] >= 0 and self.mouse_tile["y"] >= 0:
            # 半透明背景
            s = pygame.Surface((self.tile_size, self.tile_size), pygame.SRCALPHA)
            s.fill(COLORS["mouse_tile"])
            self.screen.blit(s, (self.mouse_tile["x"] * self.tile_size, self.mouse_tile["y"] * self.tile_size))
            
            # 边框
            rect = pygame.Rect(
                self.mouse_tile["x"] * self.tile_size + 0.5,
                self.mouse_tile["y"] * self.tile_size + 0.5,
                self.tile_size - 1,
                self.tile_size - 1
            )
            pygame.draw.rect(self.screen, COLORS["mouse_tile_border"], rect, 1)
            
            # 坐标文本
            coord_text = self.font_bold.render(
                f"{self.mouse_tile['x']},{self.mouse_tile['y']}",
                True, COLORS["mouse_tile_border"]
            )
            text_rect = coord_text.get_rect(
                center=(
                    self.mouse_tile["x"] * self.tile_size + self.tile_size // 2,
                    self.mouse_tile["y"] * self.tile_size + self.tile_size // 2
                )
            )
            self.screen.blit(coord_text, text_rect)
        
        # 悬停指令高亮
        if self.hovered_instruction_index >= 0 and len(self.map_data["instructions"]) > self.hovered_instruction_index:
            instr = self.map_data["instructions"][self.hovered_instruction_index]
            rect = pygame.Rect(
                instr.startX * self.tile_size + 1,
                instr.startY * self.tile_size + 1,
                (instr.endX - instr.startX + 1) * self.tile_size - 2,
                (instr.endY - instr.startY + 1) * self.tile_size - 2
            )
            pygame.draw.rect(self.screen, COLORS["hover_instr"], rect, 2)
        
        # 选中指令高亮
        if self.selected_instruction_index >= 0 and len(self.map_data["instructions"]) > self.selected_instruction_index:
            instr = self.map_data["instructions"][self.selected_instruction_index]
            rect = pygame.Rect(
                instr.startX * self.tile_size + 1,
                instr.startY * self.tile_size + 1,
                (instr.endX - instr.startX + 1) * self.tile_size - 2,
                (instr.endY - instr.startY + 1) * self.tile_size - 2
            )
            pygame.draw.rect(self.screen, COLORS["selected_instr"], rect, 2)
        
        # 拖动选择预览
        if self.is_dragging and self.drag_start and self.drag_current:
            sx = min(self.drag_start["x"], self.drag_current["x"])
            sy = min(self.drag_start["y"], self.drag_current["y"])
            ex = max(self.drag_start["x"], self.drag_current["x"])
            ey = max(self.drag_start["y"], self.drag_current["y"])
            
            # 半透明背景
            s = pygame.Surface(
                ((ex - sx + 1) * self.tile_size, (ey - sy + 1) * self.tile_size),
                pygame.SRCALPHA
            )
            fill_color = COLORS["drag_solid"] if self.drag_draw_type == '1' else COLORS["drag_empty"]
            s.fill(fill_color)
            self.screen.blit(s, (sx * self.tile_size, sy * self.tile_size))
            
            # 边框
            rect = pygame.Rect(
                sx * self.tile_size + 0.5,
                sy * self.tile_size + 0.5,
                (ex - sx + 1) * self.tile_size - 1,
                (ey - sy + 1) * self.tile_size - 1
            )
            border_color = COLORS["drag_solid_border"] if self.drag_draw_type == '1' else COLORS["drag_empty_border"]
            pygame.draw.rect(self.screen, border_color, rect, 2)

    def draw_side_panel(self):
        """绘制右侧控制面板（修复布局错位）"""
        panel_x = MAP_WIDTH * self.tile_size
        panel_width = WINDOW_WIDTH - panel_x
        padding = 20  # 面板内边距
        line_spacing = 40  # 行间距
        element_spacing = 10  # 元素之间的间距

        # 面板背景
        panel_rect = pygame.Rect(panel_x, 0, panel_width, WINDOW_HEIGHT)
        pygame.draw.rect(self.screen, COLORS["panel_bg"], panel_rect)
        pygame.draw.rect(self.screen, COLORS["panel_shadow"], panel_rect, 1)

        # 1. 顶部按钮（保持原位置）
        self.draw_button("new", "New", COLORS["primary"])
        self.draw_button("import_json", "Import JSON", COLORS["secondary"])
        self.draw_button("import_str", "Import String", COLORS["secondary"])
        self.draw_button("export_json", "Export JSON", COLORS["primary"])
        self.draw_button("copy_str", "Copy String", COLORS["primary"])

        # 2. 基础设置
        base_y = 120
        self.draw_text("Base Settings", panel_x + padding, base_y, font=self.font_bold)
        self.draw_text("Base:", panel_x + padding, base_y + 35)
        self.draw_dropdown("base_select", ["Empty (0)", "Solid (1)"], panel_x + padding + 80, base_y + 30)

        self.draw_text("Tile Size:", panel_x + padding, base_y + 75)
        self.draw_input_box("tile_size_input", panel_x + padding + 80, base_y + 70)

        # 3. 指令列表（动态计算高度）
        instr_list_y = base_y + 120
        self.draw_text("Instruction List", panel_x + padding, instr_list_y, font=self.font_bold)
        instr_y = instr_list_y + 30
        max_instr_y = WINDOW_HEIGHT - 180  # 预留更多底部按钮空间
        self.hovered_instruction_index = -1
        mx, my = pygame.mouse.get_pos()

        # 绘制指令列表（限制显示范围）
        for i, instr in enumerate(self.map_data["instructions"]):
            if instr_y > max_instr_y:
                self.draw_text("... (more instructions)", panel_x + padding, instr_y, self.font_small, COLORS["secondary"])
                break

            instr_text = f"#{i} type={instr.type} [{instr.startX},{instr.startY}]→[{instr.endX},{instr.endY}]"
            text_surf = self.font_small.render(instr_text, True, COLORS["text"])
            text_rect = text_surf.get_rect(topleft=(panel_x + padding, instr_y))

            # 悬停检测
            if panel_x < mx < WINDOW_WIDTH and instr_y - 2 <= my <= instr_y + 18:
                self.hovered_instruction_index = i
                bg_rect = pygame.Rect(panel_x + padding - 5, instr_y - 2, panel_width - 2 * padding, 20)
                pygame.draw.rect(self.screen, (240, 247, 255), bg_rect)

            self.screen.blit(text_surf, text_rect)

            # 指令删除按钮
            del_rect = pygame.Rect(panel_x + panel_width - padding - 60, instr_y, 50, 18)
            pygame.draw.rect(self.screen, COLORS["red"], del_rect, border_radius=4)
            del_text = self.font_small.render("Delete", True, (255, 255, 255))
            del_text_rect = del_text.get_rect(center=del_rect.center)
            self.screen.blit(del_text, del_text_rect)

            instr_y += 25

        # 4. 底部操作按钮已移除，面板仅保留基础设置和指令列表

        # 状态栏（修复Y坐标，避免被遮挡）
        status_y = MAP_HEIGHT * self.tile_size + 10
        status_text = f"Tile Coordinates: ({self.mouse_tile['x']}, {self.mouse_tile['y']}) | "
        status_text += f"Tile Value: {self.map_array[self.mouse_tile['y']][self.mouse_tile['x']] if self.mouse_tile['x'] >=0 else '-'} | "
        status_text += f"Selected Instruction: {self.selected_instruction_index if self.selected_instruction_index >=0 else '-'}"
        status_surf = self.font_small.render(status_text, True, COLORS["text"])
        self.screen.blit(status_surf, (10, status_y))

    def draw_button(self, btn_id: str, text: str, color: Tuple[int, int, int], disabled: bool = False):
        """绘制按钮"""
        rect = self.buttons[btn_id]
        if disabled:
            color = (156, 163, 175)
        
        # 按钮背景
        pygame.draw.rect(self.screen, color, rect, border_radius=6)
        
        # 按钮文本
        text_surf = self.font_normal.render(text, True, (255, 255, 255))
        text_rect = text_surf.get_rect(center=rect.center)
        self.screen.blit(text_surf, text_rect)

    def draw_text(self, text: str, x: int, y: int, font=None, color: Tuple[int, int, int] = COLORS["text"]):
        """绘制文本"""
        font = font or self.font_normal
        text_surf = font.render(text, True, color)
        self.screen.blit(text_surf, (x, y))

    def draw_input_box(self, input_id: str, x: int, y: int):
        """绘制输入框"""
        rect = self.input_rects[input_id]
        rect.x = x
        rect.y = y
        # 输入框背景
        pygame.draw.rect(self.screen, (255, 255, 255), rect, border_radius=6)
        pygame.draw.rect(self.screen, (226, 232, 240), rect, 1, border_radius=6)
        
        # 激活状态高亮
        if self.inputs["active_input"] == input_id:
            pygame.draw.rect(self.screen, COLORS["primary"], rect, 2, border_radius=6)
        
        # 输入文本
        text = self.inputs[input_id]
        text_surf = self.font_normal.render(text, True, COLORS["text"])
        text_rect = text_surf.get_rect(center=rect.center)
        self.screen.blit(text_surf, text_rect)

    def draw_dropdown(self, dropdown_id: str, options: List[str], x: int, y: int):
        """绘制下拉选择框"""
        rect = self.input_rects[dropdown_id]
        rect.x = x
        rect.y = y
        # 下拉框背景
        pygame.draw.rect(self.screen, (255, 255, 255), rect, border_radius=6)
        pygame.draw.rect(self.screen, (226, 232, 240), rect, 1, border_radius=6)
        
        # 当前选中值
        selected_idx = 0 if self.inputs[dropdown_id] == "0" else 1
        text_surf = self.font_normal.render(options[selected_idx], True, COLORS["text"])
        text_rect = text_surf.get_rect(center=rect.center)
        self.screen.blit(text_surf, text_rect)
        
        # 下拉箭头
        arrow_surf = self.font_bold.render("▼", True, COLORS["text"])
        arrow_rect = arrow_surf.get_rect(center=(rect.right - 15, rect.centery))
        self.screen.blit(arrow_surf, arrow_rect)

    def handle_events(self):
        """处理事件"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            
            # 鼠标移动
            elif event.type == pygame.MOUSEMOTION:
                mx, my = event.pos
                # 更新鼠标瓦片位置
                if mx < MAP_WIDTH * self.tile_size and my < MAP_HEIGHT * self.tile_size:
                    tx = int(mx // self.tile_size)
                    ty = int(my // self.tile_size)
                    tx, ty = self.clamp_coord(tx, ty)
                    if tx != self.mouse_tile["x"] or ty != self.mouse_tile["y"]:
                        self.mouse_tile["x"] = tx
                        self.mouse_tile["y"] = ty
                else:
                    self.mouse_tile["x"] = -1
                    self.mouse_tile["y"] = -1
                
                # 更新拖动状态
                if self.is_dragging:
                    if self.mouse_tile["x"] >= 0 and self.mouse_tile["y"] >= 0:
                        self.drag_current = {"x": self.mouse_tile["x"], "y": self.mouse_tile["y"]}
            
            # 鼠标按下
            elif event.type == pygame.MOUSEBUTTONDOWN:
                mx, my = event.pos
                btn = event.button
                
                # 地图区域拖动 (Shift + 左键/右键)
                if mx < MAP_WIDTH * self.tile_size and my < MAP_HEIGHT * self.tile_size:
                    keys = pygame.key.get_pressed()
                    if keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT]:
                        if btn == 1:  # 左键 - 实心
                            self.drag_draw_type = '1'
                            self.is_dragging = True
                            self.drag_start = {"x": self.mouse_tile["x"], "y": self.mouse_tile["y"]}
                            self.drag_current = {"x": self.mouse_tile["x"], "y": self.mouse_tile["y"]}
                        elif btn == 3:  # 右键 - 空心
                            self.drag_draw_type = '0'
                            self.is_dragging = True
                            self.drag_start = {"x": self.mouse_tile["x"], "y": self.mouse_tile["y"]}
                            self.drag_current = {"x": self.mouse_tile["x"], "y": self.mouse_tile["y"]}
                    else:
                        # 点击选择指令
                        if not self.was_dragging:
                            self.selected_instruction_index = -1
                            for i in reversed(range(len(self.map_data["instructions"]))):
                                instr = self.map_data["instructions"][i]
                                if (instr.startX <= self.mouse_tile["x"] <= instr.endX and
                                    instr.startY <= self.mouse_tile["y"] <= instr.endY):
                                    self.selected_instruction_index = i
                                    # 更新输入框
                                    self.inputs["type_select"] = instr.type
                                    self.inputs["startX"] = str(instr.startX)
                                    self.inputs["startY"] = str(instr.startY)
                                    self.inputs["endX"] = str(instr.endX)
                                    self.inputs["endY"] = str(instr.endY)
                                    break
                
                # 右侧面板按钮点击
                else:
                    panel_x = MAP_WIDTH * self.tile_size
                    # 检查按钮点击
                    for btn_id, rect in self.buttons.items():
                        if rect.collidepoint(mx, my):
                            if btn_id == "new":
                                self.map_data = {"base": "0", "instructions": []}
                                self.inputs["base_select"] = "0"
                                self.selected_instruction_index = -1
                                self.hovered_instruction_index = -1
                                self.generate_map_array()
                            elif btn_id == "import_json":
                                self.import_from_json()
                            elif btn_id == "import_str":
                                self.import_from_string()
                            elif btn_id == "export_json":
                                self.export_to_json()
                            elif btn_id == "copy_str":
                                self.copy_to_clipboard()
                            # no add/edit instruction buttons in the right panel
                    
                    # 检查下拉框点击
                    for dropdown_id in ["base_select"]:
                        rect = self.input_rects[dropdown_id]
                        if rect.collidepoint(mx, my):
                            self.inputs[dropdown_id] = "1" if self.inputs[dropdown_id] == "0" else "0"
                            self.map_data["base"] = self.inputs["base_select"]
                            self.generate_map_array()
                    
                    # 检查输入框点击
                    for input_id in ["tile_size_input"]:
                        rect = self.input_rects[input_id]
                        if rect.collidepoint(mx, my):
                            self.inputs["active_input"] = input_id
                        else:
                            if self.inputs["active_input"] == input_id and not rect.collidepoint(mx, my):
                                self.inputs["active_input"] = None
                    
                    # 检查指令列表点击
                    if mx > panel_x:
                        instr_y = 230
                        max_instr_y = WINDOW_HEIGHT - 150
                        for i, _ in enumerate(self.map_data["instructions"]):
                            if instr_y > max_instr_y:
                                break
                            # 指令文本点击
                            if instr_y - 2 <= my <= instr_y + 18 and mx < panel_x + 200:
                                self.selected_instruction_index = i
                                instr = self.map_data["instructions"][i]
                                self.inputs["type_select"] = instr.type
                                self.inputs["startX"] = str(instr.startX)
                                self.inputs["startY"] = str(instr.startY)
                                self.inputs["endX"] = str(instr.endX)
                                self.inputs["endY"] = str(instr.endY)
                                break
                            # 删除按钮点击
                            del_rect = pygame.Rect(panel_x + WINDOW_WIDTH - panel_x - 65, instr_y, 50, 18)
                            if del_rect.collidepoint(mx, my):
                                self.map_data["instructions"].pop(i)
                                if self.selected_instruction_index == i:
                                    self.selected_instruction_index = -1
                                self.generate_map_array()
                                break
                            instr_y += 25
            
            # 鼠标释放
            elif event.type == pygame.MOUSEBUTTONUP:
                if self.is_dragging:
                    self.is_dragging = False
                    if self.drag_start and self.drag_current:
                        sx = min(self.drag_start["x"], self.drag_current["x"])
                        sy = min(self.drag_start["y"], self.drag_current["y"])
                        ex = max(self.drag_start["x"], self.drag_current["x"])
                        ey = max(self.drag_start["y"], self.drag_current["y"])
                        
                        # 添加新指令
                        new_instr = Instruction(
                            type=self.drag_draw_type,
                            startX=sx,
                            startY=sy,
                            endX=ex,
                            endY=ey
                        )
                        self.map_data["instructions"].append(new_instr)
                        self.generate_map_array()
                        self.was_dragging = True
                        pygame.time.set_timer(pygame.USEREVENT, 50)  # 50ms后重置
                    self.drag_start = None
                    self.drag_current = None
            
            # 键盘输入
            elif event.type == pygame.KEYDOWN:
                if self.inputs["active_input"]:
                    input_id = self.inputs["active_input"]
                    if event.key == pygame.K_BACKSPACE:
                        self.inputs[input_id] = self.inputs[input_id][:-1]
                    elif event.key == pygame.K_RETURN:
                        self.inputs["active_input"] = None
                        # 更新tile size
                        if input_id == "tile_size_input":
                            try:
                                new_size = int(self.inputs[input_id])
                                self.tile_size = max(8, min(64, new_size))
                                self.update_ui_positions()  # 瓦片尺寸变化，更新UI位置
                                self.generate_map_array()
                            except:
                                self.inputs[input_id] = str(self.tile_size)
                    elif event.unicode.isdigit():
                        self.inputs[input_id] += event.unicode
            
            # 自定义事件 - 重置拖动状态
            elif event.type == pygame.USEREVENT:
                self.was_dragging = False
                pygame.time.set_timer(pygame.USEREVENT, 0)

    def add_instruction(self):
        """添加新指令"""
        try:
            startX = int(self.inputs["startX"])
            startY = int(self.inputs["startY"])
            endX = int(self.inputs["endX"])
            endY = int(self.inputs["endY"])
            
            startX, startY = self.clamp_coord(startX, startY)
            endX, endY = self.clamp_coord(endX, endY)
            
            # 交换坐标确保start <= end
            if endX < startX:
                startX, endX = endX, startX
            if endY < startY:
                startY, endY = endY, startY
            
            new_instr = Instruction(
                type=self.inputs["type_select"],
                startX=startX,
                startY=startY,
                endX=endX,
                endY=endY
            )
            self.map_data["instructions"].append(new_instr)
            self.generate_map_array()
        except:
            pass

    def update_instruction(self):
        """更新选中的指令"""
        if self.selected_instruction_index < 0:
            return
        try:
            instr = self.map_data["instructions"][self.selected_instruction_index]
            instr.type = self.inputs["type_select"]
            instr.startX = int(self.inputs["startX"])
            instr.startY = int(self.inputs["startY"])
            instr.endX = int(self.inputs["endX"])
            instr.endY = int(self.inputs["endY"])
            
            instr.startX, instr.startY = self.clamp_coord(instr.startX, instr.startY)
            instr.endX, instr.endY = self.clamp_coord(instr.endX, instr.endY)
            
            if instr.endX < instr.startX:
                instr.startX, instr.endX = instr.endX, instr.startX
            if instr.endY < instr.startY:
                instr.startY, instr.endY = instr.endY, instr.startY
            
            self.generate_map_array()
        except:
            pass

    def delete_instruction(self):
        """删除选中的指令"""
        if self.selected_instruction_index >= 0:
            self.map_data["instructions"].pop(self.selected_instruction_index)
            self.selected_instruction_index = -1
            self.hovered_instruction_index = -1
            self.generate_map_array()

    def export_to_json(self):
        """导出为JSON文件"""
        # 转换为可序列化的格式
        export_data = {
            "base": self.map_data["base"],
            "instructions": [
                {
                    "type": instr.type,
                    "startX": instr.startX,
                    "startY": instr.startY,
                    "endX": instr.endX,
                    "endY": instr.endY
                }
                for instr in self.map_data["instructions"]
            ]
        }
        
        # 保存文件
        with open("map.json", "w", encoding="utf-8") as f:
            json.dump(export_data, f, indent=2)

    def import_from_json(self):
        """从JSON文件导入"""
        try:
            with open("map.json", "r", encoding="utf-8") as f:
                data = json.load(f)
            
            self.map_data["base"] = str(data.get("base", "0"))
            self.map_data["instructions"] = [
                Instruction(
                    type=str(instr.get("type", "0")),
                    startX=int(instr.get("startX", 0)),
                    startY=int(instr.get("startY", 0)),
                    endX=int(instr.get("endX", 0)),
                    endY=int(instr.get("endY", 0))
                )
                for instr in data.get("instructions", [])
            ]
            
            self.inputs["base_select"] = self.map_data["base"]
            self.selected_instruction_index = -1
            self.hovered_instruction_index = -1
            self.generate_map_array()
        except:
            pass

    def import_from_string(self):
        """从字符串导入（简化版，实际使用可添加输入框）"""
        # 示例字符串，实际使用可通过输入框获取
        example_str = """base empty
solid 2 4 10 6
solid 0 14 31 15"""
        
        try:
            lines = example_str.split("\n")
            first_line = lines[0].strip().split()
            if first_line[0].lower() != "base":
                return
            
            self.map_data["base"] = "1" if first_line[1].lower() == "solid" else "0"
            self.inputs["base_select"] = self.map_data["base"]
            
            self.map_data["instructions"] = []
            for line in lines[1:]:
                parts = line.strip().split()
                if len(parts) != 5:
                    continue
                
                type_str = "1" if parts[0].lower() == "solid" else "0"
                startX, startY, endX, endY = map(int, parts[1:])
                
                instr = Instruction(
                    type=type_str,
                    startX=startX,
                    startY=startY,
                    endX=endX,
                    endY=endY
                )
                self.map_data["instructions"].append(instr)
            
            self.selected_instruction_index = -1
            self.hovered_instruction_index = -1
            self.generate_map_array()
        except:
            pass

    def copy_to_clipboard(self):
        """复制为字符串（简化版）"""
        # 构建字符串
        result = f"base {'solid' if self.map_data['base'] == '1' else 'empty'}\n"
        for instr in self.map_data["instructions"]:
            type_str = "solid" if instr.type == "1" else "empty"
            result += f"{type_str} {instr.startX} {instr.startY} {instr.endX} {instr.endY}\n"
        
        # 复制到剪贴板（Windows）
        try:
            if os.name == "nt":
                import win32clipboard
                win32clipboard.OpenClipboard()
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardText(result)
                win32clipboard.CloseClipboard()
        except:
            pass

    def run(self):
        """主循环"""
        while True:
            self.handle_events()
            self.render()
            self.clock.tick(60)

# 运行编辑器
if __name__ == "__main__":
    editor = LevelEditor()
    editor.run()