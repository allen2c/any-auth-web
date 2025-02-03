import { createRoot } from "react-dom/client";
import { createApp } from "./base.jsx";

const root = createRoot(document.getElementById("root")); // eslint-disable-line
root.render(createApp());
