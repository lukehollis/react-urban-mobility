import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapView from './MapView'; // New import
import './index.css';

const WS_URL = 'wss://urban-marl.mused.com/ws/marl_state'; 

// Agent speeds (degrees per second - adjust as needed)
const VEHICLE_SPEED_DEGREES_PER_SEC = 0.0005; // Approx 55 km/h at equator if 1 deg = 111km
const PEDESTRIAN_SPEED_DEGREES_PER_SEC = 0.0001;
const FLEEING_SPEED_MULTIPLIER = 2.0;

// Threshold for reaching a waypoint (in degrees)
const TARGET_REACHED_THRESHOLD_DEGREES = 0.00005;
const PATH_REQUEST_COOLDOWN_MS = 3000; // Cooldown before requesting a new path

interface Agent {
  id: string;
  position: [number, number]; // [lat, lng]
  type: number; // 0: pedestrian, 1: vehicle
  is_fleeing?: boolean;
  path_coords?: [number, number, number][] | null; // [lat, lng, elevation] from server
  currentPathIndex?: number;
  goal?: [number, number]; // Store the final goal for path requests
  lastPathRequestTime?: number; // Track when a new path was last requested
}

// Define a type for the focus payload for clarity
interface FocusPayload {
  focus_latitude?: number;
  focus_longitude?: number;
}

function App() {
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const ws = useRef<WebSocket | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>([37.7749, -122.4194]); // Default SF
  const initialCenterSet = useRef(false); // To ensure we only set initial center once from first agent if no focus
  const lastFrameTime = useRef(performance.now());

  const requestNewPath = useCallback((agentId: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log(`Requesting new path for agent ${agentId}`);
      ws.current.send(JSON.stringify({
        type: "request_new_path",
        payload: { agent_id: agentId }
      }));
      // Update last request time
      setAgents(prev => {
        if (!prev[agentId]) return prev;
        return { ...prev, [agentId]: { ...prev[agentId], lastPathRequestTime: performance.now() } };
      });
    }
  }, []);

  useEffect(() => {
    console.log("Attempting WebSocket connection...");
    ws.current = new WebSocket(WS_URL);
    const currentWs = ws.current; // Capture current instance for handlers

    currentWs.onopen = () => {
      setConnectionStatus('Connected');
      console.log('WebSocket connected');
      
      // Define focus payload for initial agent request
      const focusPayload: FocusPayload = {
        // Uncomment and set these to focus the map on a specific area
        // focus_latitude: 37.7749, 
        // focus_longitude: -122.4194
      };

      if (focusPayload.focus_latitude && focusPayload.focus_longitude) {
        setMapCenter([focusPayload.focus_latitude, focusPayload.focus_longitude]);
        initialCenterSet.current = true;
      }

      currentWs.send(JSON.stringify({
        type: "request_initial_agents",
        payload: focusPayload
      }));
    };

    currentWs.onclose = () => {
      setConnectionStatus('Disconnected. Will attempt to reconnect...');
      console.log('WebSocket disconnected. Current ws ref might be old.');
      // Implement more robust reconnect logic here if needed
      // For example, using a library or a more complex useEffect dependency management
    };

    currentWs.onerror = (error) => {
      setConnectionStatus('Connection Error');
      console.error('WebSocket error:', error);
    };

    currentWs.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);

        switch (message.type) {
          case 'add_agent':
            {
              const agent = message.payload as Agent;
              setAgents(prevAgents => ({
                ...prevAgents,
                [agent.id]: {
                  ...agent,
                  currentPathIndex: (agent.path_coords && agent.path_coords.length > 0) ? 0 : undefined,
                  lastPathRequestTime: 0,
                },
              }));
              // Set initial map center to the first agent's position if not already set by focus
              if (!initialCenterSet.current && agent.position && agent.position.length === 2) {
                setMapCenter([agent.position[0], agent.position[1]]);
                initialCenterSet.current = true; 
              }
            }
            break;
          case 'initial_population_complete':
            console.log('Initial population complete:', message.payload.count, 'agents');
            break;
          case 'new_path':
            {
              const pathData = message.payload as { agent_id: string; goal: [number, number]; path_coords: [number,number,number][]; is_fleeing?: boolean };
              setAgents(prev => {
                if (!prev[pathData.agent_id]) return prev;
                return {
                  ...prev,
                  [pathData.agent_id]: {
                    ...prev[pathData.agent_id],
                    goal: pathData.goal,
                    path_coords: pathData.path_coords,
                    currentPathIndex: (pathData.path_coords && pathData.path_coords.length > 0) ? 0 : undefined,
                    is_fleeing: pathData.is_fleeing ?? prev[pathData.agent_id].is_fleeing,
                    // lastPathRequestTime is updated by the requestNewPath function itself
                  }
                };
              });
            }
            break;
          case 'update_flee_status':
             {
              const { agent_id, is_fleeing } = message.payload;
              setAgents(prevAgents => {
                if (prevAgents[agent_id]) {
                  return {
                    ...prevAgents,
                    [agent_id]: { ...prevAgents[agent_id], is_fleeing },
                  };
                }
                return prevAgents;
              });
            }
            break;
          case 'ping':
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to parse message or handle incoming data:', error);
      }
    };

    return () => {
      console.log("Cleaning up WebSocket connection...");
      if (currentWs) {
        currentWs.close();
      }
      ws.current = null; // Clear the ref on cleanup
    };
  }, [requestNewPath]); // Empty dependency array: runs once on mount, cleans up on unmount

  // Animation loop
  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      const deltaTime = (timestamp - lastFrameTime.current) / 1000; // seconds
      lastFrameTime.current = timestamp;

      setAgents(prevAgents => {
        const updatedAgents = { ...prevAgents };
        let needsUpdate = false;

        for (const id in updatedAgents) {
          const agent = { ...updatedAgents[id] }; // Create a mutable copy

          // For now, fleeing only changes color (handled by MapView). Actual flee movement logic is complex without stimulus position.
          // if (agent.is_fleeing) { ... }

          if (agent.path_coords && typeof agent.currentPathIndex === 'number' && agent.currentPathIndex < agent.path_coords.length) {
            const targetWaypoint = agent.path_coords[agent.currentPathIndex];
            const targetPos: [number, number] = [targetWaypoint[0], targetWaypoint[1]];

            const dx = targetPos[1] - agent.position[1]; // lng diff
            const dy = targetPos[0] - agent.position[0]; // lat diff
            const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

            const speed = agent.type === 0 ? PEDESTRIAN_SPEED_DEGREES_PER_SEC : VEHICLE_SPEED_DEGREES_PER_SEC;
            const moveDist = speed * deltaTime * (agent.is_fleeing ? FLEEING_SPEED_MULTIPLIER : 1);

            if (distanceToTarget <= TARGET_REACHED_THRESHOLD_DEGREES || moveDist >= distanceToTarget) {
              agent.position = [...targetPos]; // Snap to target
              agent.currentPathIndex++;
              if (agent.currentPathIndex >= agent.path_coords.length) {
                // Reached end of path
                console.log(`Agent ${agent.id} reached end of path.`);
                agent.path_coords = null;
                agent.currentPathIndex = undefined;
                // Request new path if cooldown has passed
                if (!agent.lastPathRequestTime || (performance.now() - agent.lastPathRequestTime > PATH_REQUEST_COOLDOWN_MS)){
                    requestNewPath(agent.id);
                }
              }
            } else {
              const moveX = (dx / distanceToTarget) * moveDist;
              const moveY = (dy / distanceToTarget) * moveDist;
              agent.position[0] += moveY;
              agent.position[1] += moveX;
            }
            updatedAgents[id] = agent;
            needsUpdate = true;
          } else if (agent.path_coords === null && !agent.is_fleeing) {
            // Agent has no path (e.g., reached end) and is not fleeing, check if needs new path
            if (!agent.lastPathRequestTime || (performance.now() - agent.lastPathRequestTime > PATH_REQUEST_COOLDOWN_MS)){
                // console.log(`Agent ${agent.id} has no path and cooldown passed. Requesting new path.`);
                // requestNewPath(agent.id); // This might be too aggressive, handled above now
            }
          }
        }
        return needsUpdate ? updatedAgents : prevAgents;
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [requestNewPath]);

  return (
    <div className="app-container">
      <header>
        <h1>MARL Agent Viewer</h1>
        <div className="status-bar">Status: {connectionStatus}</div>
      </header>
      {/* Use MapView and pass agents and potentially initialCenter */}
      <MapView agents={agents} defaultCenter={mapCenter} />
      
      {Object.keys(agents).length > 0 && (
        <div>
          <h2>Agents Online: {Object.keys(agents).length}</h2>
          <ul className="agent-list">
            {(Object.values(agents) as Agent[]).slice(0, 20).map(agent => (
              <li key={agent.id}>
                ID: {agent.id} - Type: {agent.type === 0 ? 'Ped' : 'Veh'} - Pos: {agent.position[0].toFixed(4)}, {agent.position[1].toFixed(4)}
                {agent.is_fleeing && <span style={{ color: 'red', marginLeft: '10px' }}>(Fleeing)</span>}
              </li>
            ))}
            {Object.keys(agents).length > 20 && <li>...and {Object.keys(agents).length - 20} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App; 