# MARL Urban Mobility Agent Viewer (React Example)

This is a basic React application (bootstrapped with Vite and TypeScript) that demonstrates how to connect to the Multi-Agent Reinforcment Learning Urban Mobility WebSocket API and display agent information.

This is an example application that connects to the Urban Mobility server MARL API and accessible (defaults to `wss://urban-marl.mused.com/ws/marl_state`).

I've been using this for my research for creating simulations of human behaviors in geospatial environments. I hope to continue to extend it with more features in the future. 


## Setup & Running

1.  **Clone this repo**:
    ```bash
    git clone git@github.com:lukehollis/react-urban-mobility.git
    ```

2.  **Install Dependencies**:
    If using pnpm (recommended for consistency with the parent project's preferences if applicable):
    ```bash
    pnpm install
    ```
    Alternatively, use npm or yarn:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Start the Development Server**:
    ```bash
    pnpm run dev
    ```
    Or, if using npm/yarn:
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    This will typically open the application in your web browser at `http://localhost:5173` (Vite's default port, but check your terminal output).

## Features

*   Connects to the MARL WebSocket server.
*   Requests initial agent data upon connection.
*   Displays the WebSocket connection status.
*   Shows a placeholder for a map where agents would be visualized.
*   Lists a summary of received agent data (ID, type, position, fleeing status).
*   Handles `add_agent`, `initial_population_complete`, `new_path`, and `update_flee_status` messages from the server.

## Customization

*   **WebSocket URL**: The URL is defined in `src/App.tsx` (`WS_URL`). Modify this if your server runs on a different host or port.
*   **Map Implementation**: The `src/MapPlaceholder.tsx` component is a simple placeholder. To visualize agents on an actual map, you would replace its content with a map library integration (e.g., Leaflet, React Leaflet, Mapbox GL JS, Google Maps React components).
*   **Agent Properties**: The `Agent` interface in `src/App.tsx` can be extended to include more properties if your server sends additional data per agent.
*   **Styling**: Basic styles are in `src/index.css`.

## Building for Production

To create a production build:
```bash
pnpm run build
# or npm run build / yarn build
```
This will generate static assets in the `dist` folder. 