import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';

// Define the Agent interface (can be shared or imported if defined elsewhere prominently)
interface Agent {
  id: string;
  position: [number, number]; // [lat, lng]
  type: number;
  is_fleeing?: boolean;
  // Add other relevant properties you might want to display or use for styling
}

interface MapViewProps {
  agents: Record<string, Agent>;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

const AGENT_COLORS: Record<number, string> = {
  0: '#ffffff', // Pedestrian (white)
  1: '#0066cc', // Vehicle (blue)
  // Add more types if needed
};
const FLEEING_COLOR = '#ff0000'; // Red for fleeing

const MapView: React.FC<MapViewProps> = ({ 
  agents, 
  defaultCenter = [37.7749, -122.4194], // Default to San Francisco
  defaultZoom = 13 
}) => {
  const agentArray = Object.values(agents);

  return (
    <MapContainer center={defaultCenter as LatLngExpression} zoom={defaultZoom} style={{ height: '600px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {agentArray.map(agent => {
        if (!agent.position || agent.position.length !== 2) return null;
        const position: LatLngExpression = [agent.position[0], agent.position[1]];
        const color = agent.is_fleeing ? FLEEING_COLOR : (AGENT_COLORS[agent.type] || '#808080'); // Default to grey if type unknown

        return (
          <CircleMarker
            key={agent.id}
            center={position}
            radius={agent.type === 0 ? 4 : 6} // Smaller for pedestrians, larger for vehicles
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.7,
            }}
          >
            <Tooltip>
              ID: {agent.id}<br />
              Type: {agent.type === 0 ? 'Pedestrian' : 'Vehicle'}<br />
              Position: {agent.position[0].toFixed(4)}, {agent.position[1].toFixed(4)}
              {agent.is_fleeing && <><br />Status: Fleeing</>}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
};

export default MapView; 