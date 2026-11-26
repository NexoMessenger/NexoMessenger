package dev.rustlike.client;

import dev.rustlike.piece.PieceType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.item.ItemStack;
import org.lwjgl.glfw.GLFW;

/**
 * Круговое меню строительного плана (по мотивам колеса Rust).
 *
 * Четыре сектора:
 *   NW — Фундамент,   NE — Стена,
 *   SW — Проём,       SE — Дверь.
 *
 * Выбор: мышью (навести + ЛКМ), цифрами 1–4 или Enter.
 * Закрытие: Esc.
 */
public class RadialMenuScreen extends net.minecraft.client.gui.screens.Screen {

    private static final PieceType[] PIECES = {
            PieceType.FOUNDATION, PieceType.WALL, PieceType.DOORWAY, PieceType.DOOR
    };

    private static final int INNER_RADIUS = 26;
    private static final int OUTER_RADIUS = 104;

    private int hovered = -1;
    private final Component screenTitle = Component.translatable("rustlike.radial.title");

    public RadialMenuScreen() {
        super(Component.translatable("rustlike.radial.title"));
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    private int cx() {
        return this.width / 2;
    }

    private int cy() {
        return this.height / 2;
    }

    /** Какой сектор под курсором (-1 — центр/вне колеса). */
    private int sectorAt(double mouseX, double mouseY) {
        double dx = mouseX - cx();
        double dy = mouseY - cy();
        double dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < INNER_RADIUS || dist > OUTER_RADIUS + 8) {
            return -1;
        }
        double angle = Math.toDegrees(Math.atan2(dy, dx));
        if (angle < 0) {
            angle += 360.0;
        }
        if (angle < 90) {
            return 3;   // SE — дверь
        } else if (angle < 180) {
            return 2;   // SW — проём
        } else if (angle < 270) {
            return 0;   // NW — фундамент
        }
        return 1;       // NE — стена
    }

    /** Диапазон углов сектора (начало, конец) в градусах экрана. */
    private static double[] sectorAngles(int index) {
        switch (index) {
            case 0:  return new double[]{180, 270}; // NW
            case 1:  return new double[]{270, 360}; // NE
            case 2:  return new double[]{90, 180};  // SW
            default: return new double[]{0, 90};    // SE
        }
    }

    @Override
    public void render(GuiGraphics gui, int mouseX, int mouseY, float partialTick) {
        this.renderBackground(gui);
        int cx = cx();
        int cy = cy();
        hovered = sectorAt(mouseX, mouseY);

        // Сектора: подсвечиваем наведённый, остальные слегка затемняем.
        for (int i = 0; i < 4; i++) {
            double[] angles = sectorAngles(i);
            int color = (i == hovered) ? 0x66FFFFFF : 0x22000000;
            fillSector(gui, cx, cy, INNER_RADIUS, OUTER_RADIUS, angles[0], angles[1], color);
        }

        // Круги: внешний и внутренний.
        drawCircle(gui, cx, cy, OUTER_RADIUS, 0xFFFFFFFF);
        drawCircle(gui, cx, cy, INNER_RADIUS, 0xFFFFFFFF);

        // Разделители между секторами (по диагоналям).
        for (int i = 0; i < 4; i++) {
            drawRadialLine(gui, cx, cy, INNER_RADIUS, OUTER_RADIUS, 45 + i * 90, 0x88FFFFFF);
        }

        // Иконки и подписи секторов.
        for (int i = 0; i < 4; i++) {
            drawSectorContent(gui, cx, cy, i);
        }

        // Центр: иконка плана + текущий выбор.
        ItemStack planIcon = new ItemStack(dev.rustlike.ModRegistry.BUILDING_PLAN.get());
        gui.renderItem(planIcon, cx - 8, cy - 16);
        gui.renderItemDecorations(this.font, planIcon, cx - 8, cy - 16);
        gui.drawCenteredString(this.font,
                Component.translatable(ClientState.selected().nameKey()),
                cx, cy + 6, 0xFFFFD755);

        // Заголовок и подсказка.
        gui.drawCenteredString(this.font, this.screenTitle, cx, 14, 0xFFFFD755);
        gui.drawCenteredString(this.font,
                Component.translatable("rustlike.radial.hint"),
                cx, this.height - 22, 0xFFAAAAAA);
    }

    private void drawSectorContent(GuiGraphics gui, int cx, int cy, int index) {
        PieceType piece = PIECES[index];
        double mid = (sectorAngles(index)[0] + sectorAngles(index)[1]) / 2.0;
        double rad = Math.toRadians(mid);
        int iconX = cx + (int) (Math.cos(rad) * 58) - 8;
        int iconY = cy + (int) (Math.sin(rad) * 52) - 8;

        ItemStack icon = new ItemStack(piece.iconItem());
        gui.renderItem(icon, iconX, iconY);
        gui.renderItemDecorations(this.font, icon, iconX, iconY);

        int nameColor = (index == hovered) ? 0xFFFFD755 : 0xFFFFFFFF;
        gui.drawCenteredString(this.font,
                Component.translatable(piece.nameKey()),
                iconX + 8, iconY + 20, nameColor);

        if (index == hovered) {
            gui.drawCenteredString(this.font,
                    Component.translatable("rustlike.radial.cost",
                            piece.placeCost(),
                            Component.translatable(piece.placeCostItem().getDescriptionId())),
                    iconX + 8, iconY + 33, 0xFFAAAAAA);
        }
    }

    /** Закрашивание сектора кольца маленькими квадратами (имитация «арки»). */
    private void fillSector(GuiGraphics gui, int cx, int cy, int r0, int r1,
                            double a0, double a1, int color) {
        for (double a = a0; a <= a1; a += 2.0) {
            double rad = Math.toRadians(a);
            double cos = Math.cos(rad);
            double sin = Math.sin(rad);
            for (int r = r0; r <= r1; r += 3) {
                int x = cx + (int) (cos * r);
                int y = cy + (int) (sin * r);
                gui.fill(x - 1, y - 1, x + 2, y + 2, color);
            }
        }
    }

    private void drawCircle(GuiGraphics gui, int cx, int cy, int radius, int color) {
        for (double a = 0; a < 360; a += 3.0) {
            double rad = Math.toRadians(a);
            int x = cx + (int) (Math.cos(rad) * radius);
            int y = cy + (int) (Math.sin(rad) * radius);
            gui.fill(x, y, x + 2, y + 2, color);
        }
    }

    private void drawRadialLine(GuiGraphics gui, int cx, int cy, int r0, int r1,
                                double angleDeg, int color) {
        double rad = Math.toRadians(angleDeg);
        double cos = Math.cos(rad);
        double sin = Math.sin(rad);
        for (int r = r0; r <= r1; r += 3) {
            int x = cx + (int) (cos * r);
            int y = cy + (int) (sin * r);
            gui.fill(x, y, x + 2, y + 2, color);
        }
    }

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        if (button == GLFW.GLFW_MOUSE_BUTTON_LEFT) {
            int sector = sectorAt(mouseX, mouseY);
            if (sector >= 0) {
                select(sector);
                return true;
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean keyPressed(int keyCode, int scanCode, int modifiers) {
        if (keyCode >= GLFW.GLFW_KEY_1 && keyCode <= GLFW.GLFW_KEY_4) {
            select(keyCode - GLFW.GLFW_KEY_1);
            return true;
        }
        if (keyCode == GLFW.GLFW_KEY_ENTER || keyCode == GLFW.GLFW_KEY_KP_ENTER
                || keyCode == GLFW.GLFW_KEY_SPACE) {
            if (hovered >= 0) {
                select(hovered);
                return true;
            }
        }
        return super.keyPressed(keyCode, scanCode, modifiers);
    }

    private void select(int index) {
        ClientState.setSelected(PIECES[index]);
        Minecraft.getInstance().getSoundManager().play(
                SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F));
        this.onClose();
    }
}
