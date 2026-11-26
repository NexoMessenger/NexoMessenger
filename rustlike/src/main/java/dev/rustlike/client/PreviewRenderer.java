package dev.rustlike.client;

import dev.rustlike.logic.PlacementRules;
import dev.rustlike.piece.PieceType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraftforge.client.event.RenderLevelStageEvent;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.world.phys.HitResult;
import org.joml.Matrix4f;

/**
 * Превью установки: зелёная/красная рамка под прицелом
 * при удержании строительного плана.
 */
public final class PreviewRenderer {

    /** Полупрозрачная заливка и контур. */
    private static final float[] GREEN = {0.25F, 1.0F, 0.35F};
    private static final float[] RED = {1.0F, 0.25F, 0.25F};

    private PreviewRenderer() {
    }

    public static void render(RenderLevelStageEvent event) {
        if (event.getStage() != RenderLevelStageEvent.Stage.AFTER_TRANSLUCENT_BLOCKS) {
            return;
        }

        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.level == null || mc.screen != null) {
            return;
        }
        if (!(mc.player.getMainHandItem().getItem() instanceof dev.rustlike.item.BuildingPlanItem)) {
            return;
        }
        if (!(mc.hitResult instanceof BlockHitResult hit) || hit.getType() == HitResult.Type.MISS) {
            return;
        }

        PieceType piece = ClientState.selected();
        BlockPos pos = PlacementRules.clientTargetPos(hit, piece);
        PlacementRules.Result result = PlacementRules.validate(
                mc.level, mc.player, pos, piece, false);

        float[] color = result.ok() ? GREEN : RED;
        AABB box = new AABB(pos);

        var poseStack = event.getPoseStack();
        poseStack.pushPose();
        Vec3 camera = event.getCamera().getPosition();
        poseStack.translate(-camera.x, -camera.y, -camera.z);

        // Полупрозрачная заливка (RenderType.lightning — POSITION_COLOR, всегда существует)
        var bufferSource = mc.renderBuffers().bufferSource();
        var fillBuffer = bufferSource.getBuffer(RenderType.lightning());
        drawFilledBox(fillBuffer, poseStack.last().pose(), box,
                color[0], color[1], color[2], 0.28F);
        bufferSource.endBatch(RenderType.lightning());

        // Контур
        var lineBuffer = bufferSource.getBuffer(RenderType.lines());
        LevelRenderer.renderLineBox(poseStack, lineBuffer, box,
                color[0], color[1], color[2], 0.95F);
        bufferSource.endBatch(RenderType.lines());

        poseStack.popPose();
    }

    /** Рисует 6 граней параллелепипеда (формат POSITION_COLOR). */
    private static void drawFilledBox(com.mojang.blaze3d.vertex.BufferBuilder buffer,
                                      Matrix4f pose, AABB box,
                                      float r, float g, float b, float a) {
        float x0 = (float) box.minX, y0 = (float) box.minY, z0 = (float) box.minZ;
        float x1 = (float) box.maxX, y1 = (float) box.maxY, z1 = (float) box.maxZ;

        // Низ
        quad(buffer, pose, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, r, g, b, a);
        // Верх
        quad(buffer, pose, x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, r, g, b, a);
        // Север (z0)
        quad(buffer, pose, x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0, r, g, b, a);
        // Юг (z1)
        quad(buffer, pose, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, r, g, b, a);
        // Запад (x0)
        quad(buffer, pose, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, r, g, b, a);
        // Восток (x1)
        quad(buffer, pose, x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1, r, g, b, a);
    }

    private static void quad(com.mojang.blaze3d.vertex.BufferBuilder buffer,
                             Matrix4f pose,
                             float ax, float ay, float az,
                             float bx, float by, float bz,
                             float cx, float cy, float cz,
                             float dx, float dy, float dz,
                             float r, float g, float b, float a) {
        vertex(buffer, pose, ax, ay, az, r, g, b, a);
        vertex(buffer, pose, bx, by, bz, r, g, b, a);
        vertex(buffer, pose, cx, cy, cz, r, g, b, a);
        vertex(buffer, pose, dx, dy, dz, r, g, b, a);
    }

    private static void vertex(com.mojang.blaze3d.vertex.BufferBuilder buffer,
                               Matrix4f pose,
                               float x, float y, float z,
                               float r, float g, float b, float a) {
        buffer.vertex(pose, x, y, z)
                .color(r, g, b, a)
                .endVertex();
    }
}
