package dev.rustlike.client;

import dev.rustlike.piece.PieceType;

/**
 * Состояние клиента: какой элемент сейчас выбран в строительном плане.
 * (Выбор живёт на клиенте; сервер получает его вместе с пакетом установки.)
 */
public final class ClientState {

    private static volatile PieceType selected = PieceType.FOUNDATION;

    private ClientState() {
    }

    public static PieceType selected() {
        return selected;
    }

    public static void setSelected(PieceType piece) {
        if (piece != null) {
            selected = piece;
        }
    }
}
