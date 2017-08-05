export function sleep(ms: number) {
    return new Promise<void>(done => setTimeout(done, ms));
}
