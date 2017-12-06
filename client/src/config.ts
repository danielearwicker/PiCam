const publicUrl = "http://earwicker.ddns.net:3030";

export const baseUrl = process.env.NODE_ENV === "production" ? publicUrl : location.origin;
