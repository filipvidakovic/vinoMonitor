import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { useState } from 'react'
import L from 'leaflet'

interface Props {
  latitude?: number
  longitude?: number
  onChange: (lat: number, lng: number) => void
}

function LocationMarker({ latitude, longitude, onChange }: Props) {
  const [position, setPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  )

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      setPosition([lat, lng])
      onChange(lat, lng)
    },
  })

  return position === null ? null : <Marker position={position} />
}

export default function MapPicker({ latitude, longitude, onChange }: Props) {
  return (
    <MapContainer
      center={[44.787197, 20.448883]}
      zoom={7}
      style={{ height: '400px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker
        latitude={latitude}
        longitude={longitude}
        onChange={onChange}
      />
    </MapContainer>
  )
}