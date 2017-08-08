export function sleep(ms: number) {
    return new Promise<void>(done => setTimeout(done, ms));
}

export function cancellation() {
    let cancelled = false;

    return {
        cancel() {
            cancelled = true;
        },
        get() {
            return cancelled;
        }
    };
}
