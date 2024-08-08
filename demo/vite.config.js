import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "matter": path.resolve(__dirname, "../src"),
        }
    }
});