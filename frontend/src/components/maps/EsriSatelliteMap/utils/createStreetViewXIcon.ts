/**
 * Vẽ icon dấu X nhỏ có viền trắng để nổi bật trên mọi nền đường.
 * Kích thước tính theo CSS px; tự nhân DPR để không bị mờ trên màn retina.
 */
export function createStreetViewXIcon(size = 14): HTMLCanvasElement {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";

    const pad = 3;

    const strokeX = (color: string, lineWidth: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(pad, pad);
        ctx.lineTo(size - pad, size - pad);
        ctx.moveTo(size - pad, pad);
        ctx.lineTo(pad, size - pad);
        ctx.stroke();
    };

    strokeX("#ffffff", 5);     // viền trắng (halo)
    strokeX("#1a73e8", 2.5);   // dấu X xanh

    return canvas;
}