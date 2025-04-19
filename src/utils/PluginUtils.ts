export function isFullscreen() {
    return !!document.fullscreenElement;
}

export function triggerFullscreen(onStateChange: (isFullscreen: boolean) => void, selector?: string) {
    document.addEventListener("fullscreenchange", () => {
        onStateChange(isFullscreen());
    });
    try {
        const ref = document.querySelector(selector || "#root")!
        if (!isFullscreen()) {
            // @ts-ignore
            ref.requestFullscreen() || ref.webkitRequestFullscreen()
        } else {
            // @ts-ignore
            document.exitFullscreen() || document.webkitExitFullscreen()
        }
    } catch (error: any) {
        console.error("Failed to enter fullscreen", error.message);
    }
    onStateChange(isFullscreen());
}




