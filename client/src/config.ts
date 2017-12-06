const debugUrl = "http://drepi3:3030";

export const baseUrl = process.env.NODE_ENV === "production" ? location.origin : debugUrl;
