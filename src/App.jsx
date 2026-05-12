import { useState, useEffect } from "react"
import { supabase } from "./supabase"
import L from "leaflet"

import {
  Truck, Map, Users, Package, AlertTriangle, Route, Search, Clock, Plus,
  Save, Trash2, Circle, Box, Coffee, Bed, CheckCircle, LocateFixed
} from "lucide-react"

import {
  MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker
} from "react-leaflet"

import "leaflet/dist/leaflet.css"
import "./App.css"

const COLORS = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#dc2626", "#0891b2"]

function formatHours(hours) {
  const totalMinutes = Math.round(Number(hours || 0) * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}min`
}

function calculateJourneyWithBreaks(drivingHours) {
  const dailyDriveLimit = 9
  const breakEvery = 4.5
  const breakDuration = 0.75
  const dailyRest = 11

  let remaining = drivingHours
  let total = 0
  let drivenToday = 0
  let drivenSinceBreak = 0
  let breaks = 0
  let rests = 0
  let breakSchedule = []
  let elapsed = 0

  while (remaining > 0) {
    const driveChunk = Math.min(
      remaining,
      breakEvery - drivenSinceBreak,
      dailyDriveLimit - drivenToday
    )

    if (driveChunk > 0) {
      remaining -= driveChunk
      total += driveChunk
      elapsed += driveChunk
      drivenToday += driveChunk
      drivenSinceBreak += driveChunk
    }

    if (remaining <= 0) break

    if (drivenToday >= dailyDriveLimit) {
      rests += 1
      breakSchedule.push({
        type: "Daily rest",
        after: elapsed,
        duration: dailyRest,
        text: `Daily rest after ${formatHours(elapsed)} work time`,
      })

      total += dailyRest
      elapsed += dailyRest
      drivenToday = 0
      drivenSinceBreak = 0
      continue
    }

    if (drivenSinceBreak >= breakEvery) {
      breaks += 1
      breakSchedule.push({
        type: "Break",
        after: elapsed,
        duration: breakDuration,
        text: `45 min break after ${formatHours(elapsed)}`,
      })

      total += breakDuration
      elapsed += breakDuration
      drivenSinceBreak = 0
    }
  }

  return { total, breaks, rests, breakSchedule }
}

function parseCoordinates(input) {
  const match = input.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/)
  if (!match) return null
  return { lat: parseFloat(match[1]), lon: parseFloat(match[3]) }
}

function getProgressPoint(points, load) {
  if (!points || points.length === 0) return null
  if (!load.startTime || !load.totalJourneyHours) return points[0]

  const start = new Date(load.startTime)
  const now = new Date()
  const totalMs = Number(load.totalJourneyHours) * 60 * 60 * 1000
  const passedMs = now - start

  let progress = passedMs / totalMs
  if (progress < 0) progress = 0
  if (progress > 1) progress = 1

  const index = Math.floor(progress * (points.length - 1))
  return points[index]
}

function getLoadProgress(load) {
  if (!load.startTime || !load.totalJourneyHours) return 0

  const start = new Date(load.startTime)
  const now = new Date()
  const totalMs = Number(load.totalJourneyHours) * 60 * 60 * 1000
  const passedMs = now - start

  let progress = passedMs / totalMs
  if (progress < 0) progress = 0
  if (progress > 1) progress = 1

  return Math.round(progress * 100)
}

function createTruckIcon(label, color) {
  return L.divIcon({
    className: "custom-truck-icon",
    html: `
      <div class="truck-marker" style="--marker-color:${color}">
        <div class="truck-dot">🚚</div>
        <div class="truck-label">${label}</div>
      </div>
    `,
    iconSize: [120, 40],
    iconAnchor: [20, 20],
  })
}

function RealMap({ routePoints, plannedMarker, loads = [] }) {
  const activeLoads = loads.filter(
    (load) =>
      load.routePoints &&
      load.routePoints.length >= 2 &&
      load.status !== "Delivered"
  )

  const mapPoints =
    activeLoads.length > 0
      ? activeLoads.flatMap((l) => l.routePoints)
      : routePoints

  const defaultCenter = [53.8, 23.8]

  const center =
    mapPoints.length > 0
      ? mapPoints[Math.floor(mapPoints.length / 2)]
      : defaultCenter

  return (
    <div className="real-map">
      <MapContainer
        center={center}
        zoom={mapPoints.length ? 6 : 5}
        scrollWheelZoom={true}
        className="leaflet-map"
        key={`${center[0]}-${center[1]}-${activeLoads.length}-${routePoints.length}-${loads.length}`}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {activeLoads.length > 0 ? (
          activeLoads.map((load, index) => {
            const color = COLORS[index % COLORS.length]
            const point = getProgressPoint(load.routePoints, load)
            const label = load.truck || load.id

            return (
              <div key={load.id}>
                <Polyline positions={load.routePoints} pathOptions={{ color, weight: 5 }} />

                {point && (
                  <Marker position={point} icon={createTruckIcon(label, color)}>
                    <Popup>
                      <strong>{load.id}</strong>
                      <br />
                      {load.driver}
                      <br />
                      {load.truck}
                      <br />
                      {load.status}
                      <br />
                      Progress: {getLoadProgress(load)}%
                    </Popup>
                  </Marker>
                )}
              </div>
            )
          })
        ) : (
          <>
            {routePoints.length >= 2 && (
              <>
                <Polyline positions={routePoints} pathOptions={{ color: "#1578c8", weight: 5 }} />

                <Marker position={routePoints[0]}>
                  <Popup>Start</Popup>
                </Marker>

                <Marker position={routePoints[routePoints.length - 1]}>
                  <Popup>Destination</Popup>
                </Marker>
              </>
            )}

            {plannedMarker && (
              <CircleMarker
                center={plannedMarker}
                radius={12}
                pathOptions={{
                  color: "#ef4444",
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                }}
              >
                <Popup>Planned truck position</Popup>
              </CircleMarker>
            )}
          </>
        )}
      </MapContainer>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState("dashboard")

  const [loadId, setLoadId] = useState("")
  const [customer, setCustomer] = useState("")
  const [driver, setDriver] = useState("")
  const [truck, setTruck] = useState("")
  const [startLocation, setStartLocation] = useState("")
  const [endLocation, setEndLocation] = useState("")
  const [startTime, setStartTime] = useState("")
  const [avgSpeed, setAvgSpeed] = useState("80")

  const [newDriverName, setNewDriverName] = useState("")
  const [newDriverTruck, setNewDriverTruck] = useState("")

  const [newTruckPlate, setNewTruckPlate] = useState("")
  const [newTruckType, setNewTruckType] = useState("")

  const [routePoints, setRoutePoints] = useState([])
  const [plannedMarker, setPlannedMarker] = useState(null)
  const [trackingInfo, setTrackingInfo] = useState(null)

  const [distance, setDistance] = useState(null)
  const [drivingTime, setDrivingTime] = useState(null)
  const [totalJourney, setTotalJourney] = useState(null)
  const [breaks, setBreaks] = useState(0)
  const [rests, setRests] = useState(0)
  const [breakSchedule, setBreakSchedule] = useState([])
  const [routeStatus, setRouteStatus] = useState("Ready")

  const [drivers, setDrivers] = useState([])

  const [loads, setLoads] = useState(() => {
    const saved = localStorage.getItem("transport_tms_loads")
    return saved ? JSON.parse(saved) : []
  })

  const [fleet, setFleet] = useState(() => {
    const saved = localStorage.getItem("transport_tms_fleet")
    return saved
      ? JSON.parse(saved)
      : [{ truck: "Volvo FM430", type: "Volvo FM", status: "Available" }]
  })

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    localStorage.setItem("transport_tms_loads", JSON.stringify(loads))
  }, [loads])

  useEffect(() => {
    localStorage.setItem("transport_tms_fleet", JSON.stringify(fleet))
  }, [fleet])

  async function loadDrivers() {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.log(error)
      alert("Failed to load drivers from Supabase")
      return
    }

    setDrivers(data || [])
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <Map size={18} /> },
    { id: "routes", label: "Routes", icon: <Route size={18} /> },
    { id: "drivers", label: "Drivers", icon: <Users size={18} /> },
    { id: "fleet", label: "Fleet", icon: <Truck size={18} /> },
    { id: "loads", label: "Loads", icon: <Package size={18} /> },
    { id: "alerts", label: "Alerts", icon: <AlertTriangle size={18} /> },
  ]

  const activeLoads = loads.filter((load) => load.status !== "Delivered")

  const alerts = loads
    .filter((load) => load.status !== "Delivered" && load.startTime)
    .filter((load) => {
      const arrival = new Date(load.startTime)
      arrival.setHours(arrival.getHours() + Number(load.totalJourneyHours || 0))
      return new Date() > arrival
    })
    .map((load) => ({
      type: "Delay Risk",
      text: `${load.id} should already be arrived.`,
      severity: "danger",
    }))

  const driverDailyLog = loads.map((load) => ({
    driver: load.driver,
    date: load.startTime ? new Date(load.startTime).toLocaleDateString() : "-",
    loadId: load.id,
    route: `${load.from} → ${load.to}`,
    startTime: load.startTime || "-",
    drivingTime: load.drivingTime,
    totalJourney: load.totalJourney,
    breaks: load.breaks,
    rests: load.rests,
    status: load.status,
  }))

  async function syncDriverByLoadStatus(load, status) {
    let driverStatus = "Available"
    let driverStage = "Idle"

    if (status === "Loading") {
      driverStatus = "On Duty"
      driverStage = "Loading"
    }

    if (status === "In Transit") {
      driverStatus = "On Duty"
      driverStage = "In Transit"
    }

    if (status === "Delayed") {
      driverStatus = "On Duty"
      driverStage = "In Transit"
    }

    if (status === "Delivered") {
      driverStatus = "Available"
      driverStage = "Completed"
    }

    const driverRecord = drivers.find((d) => d.name === load.driver)

    if (!driverRecord) return

    const { error } = await supabase
      .from("drivers")
      .update({
        status: driverStatus,
        current_stage: driverStage,
      })
      .eq("id", driverRecord.id)

    if (error) {
      console.log(error)
      return
    }

    loadDrivers()
  }

  function updateLoadStatus(id, status) {
    const load = loads.find((l) => l.id === id)

    setLoads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l))
    )

    if (load) syncDriverByLoadStatus(load, status)
  }

  function getInitials(name) {
    return name
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  }

  function getAvatarClass(index) {
    return ["avatar-blue", "avatar-purple", "avatar-orange", "avatar-pink", "avatar-green"][index % 5]
  }

  function getStatusClass(status) {
    if (status === "Available") return "status-available"
    if (status === "On Duty") return "status-duty"
    if (status === "Break") return "status-break"
    if (status === "Offline") return "status-offline"
    return "status-available"
  }

  function StageIcon({ stage }) {
    if (stage === "In Transit") return <Truck size={15} />
    if (stage === "Loading") return <Box size={15} />
    if (stage === "Break") return <Coffee size={15} />
    if (stage === "Rest") return <Bed size={15} />
    if (stage === "Completed") return <CheckCircle size={15} />
    return <Circle size={15} />
  }

  function getStageClass(stage) {
    if (stage === "In Transit") return "stage-transit"
    if (stage === "Loading") return "stage-loading"
    if (stage === "Break") return "stage-break"
    if (stage === "Rest") return "stage-rest"
    if (stage === "Completed") return "stage-completed"
    return "stage-idle"
  }

  function getLoadStatusClass(status) {
    if (status === "Planned") return "load-status planned"
    if (status === "Loading") return "load-status loading"
    if (status === "In Transit") return "load-status transit"
    if (status === "Delayed") return "load-status delayed"
    if (status === "Delivered") return "load-status delivered"
    return "load-status"
  }

  async function geocodeLocation(input) {
    const coord = parseCoordinates(input)
    if (coord) return coord

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(input)}`
    )

    const data = await response.json()
    if (!data.length) return null

    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  }

  async function getRoute(startText, endText) {
    const start = await geocodeLocation(startText)
    const end = await geocodeLocation(endText)

    if (!start || !end) return null

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.lon},${start.lat};${end.lon},${end.lat}` +
      `?overview=full&geometries=geojson`

    const response = await fetch(url)
    const data = await response.json()

    if (!data.routes || !data.routes.length) return null

    return data.routes[0]
  }

  async function calculateRoute() {
    if (!startLocation || !endLocation) {
      alert("Enter start and end location")
      return
    }

    setRouteStatus("Routing...")

    try {
      const route = await getRoute(startLocation, endLocation)

      if (!route) {
        alert("Route not found")
        setRouteStatus("Ready")
        return
      }

      const points = route.geometry.coordinates.map((coord) => [coord[1], coord[0]])
      const km = route.distance / 1000
      const speed = Number(avgSpeed || 80)
      const pureDrivingHours = km / speed
      const journey = calculateJourneyWithBreaks(pureDrivingHours)

      setRoutePoints(points)
      setPlannedMarker(null)
      setTrackingInfo(null)
      setDistance(km.toFixed(1))
      setDrivingTime(pureDrivingHours)
      setTotalJourney(journey.total)
      setBreaks(journey.breaks)
      setRests(journey.rests)
      setBreakSchedule(journey.breakSchedule)
      setRouteStatus("Ready")
    } catch (error) {
      console.log(error)
      alert("Route calculation error")
      setRouteStatus("Ready")
    }
  }

  async function trackLoad(load) {
    let points = load.routePoints

    if (!points || points.length < 2) {
      const route = await getRoute(load.from, load.to)

      if (!route) {
        alert("Unable to track this load route")
        return
      }

      points = route.geometry.coordinates.map((coord) => [coord[1], coord[0]])
    }

    setRoutePoints(points)
    setPlannedMarker(getProgressPoint(points, load))

    if (!load.startTime || !load.totalJourneyHours) {
      setTrackingInfo({
        status: "No tracking data",
        progress: 0,
        delayed: false,
      })

      setActivePage("dashboard")
      return
    }

    const startDate = new Date(load.startTime)
    const now = new Date()
    const totalMs = Number(load.totalJourneyHours) * 60 * 60 * 1000
    const passedMs = now - startDate

    let progress = passedMs / totalMs
    if (progress < 0) progress = 0
    if (progress > 1) progress = 1

    let status = "On route"
    let delayed = false

    if (passedMs < 0) status = "Not started"

    if (progress >= 1) {
      status = "Should be arrived"
      if (load.status !== "Delivered") delayed = true
    }

    setTrackingInfo({
      status,
      progress: Math.round(progress * 100),
      delayed,
    })

    setActivePage("dashboard")
  }

  function saveLoad() {
    if (!loadId || !customer || !driver || !truck) {
      alert("Fill all required fields")
      return
    }

    if (!distance || !drivingTime || !totalJourney || routePoints.length < 2) {
      alert("Calculate route before saving")
      return
    }

    const newLoad = {
      id: loadId,
      customer,
      driver,
      truck,
      from: startLocation,
      to: endLocation,
      startTime,
      status: "Planned",
      distance: `${distance} km`,
      drivingTime: formatHours(drivingTime),
      totalJourney: formatHours(totalJourney),
      totalJourneyHours: totalJourney?.toFixed(2),
      breaks,
      rests,
      breakSchedule,
      routePoints,
    }

    setLoads((prev) => [newLoad, ...prev])
    setLoadId("")
    setCustomer("")
    setDriver("")
    setTruck("")
  }

  async function addDriver() {
    if (!newDriverName || !newDriverTruck) return

    const { error } = await supabase.from("drivers").insert([
      {
        name: newDriverName,
        truck: newDriverTruck,
        status: "Available",
        current_stage: "Idle",
      },
    ])

    if (error) {
      console.log(error)
      alert("Failed to add driver")
      return
    }

    setNewDriverName("")
    setNewDriverTruck("")
    loadDrivers()
  }

  async function deleteDriver(id) {
    const { error } = await supabase.from("drivers").delete().eq("id", id)

    if (error) {
      console.log(error)
      alert("Failed to delete driver")
      return
    }

    loadDrivers()
  }

  async function updateDriverStatus(id, status) {
    const { error } = await supabase.from("drivers").update({ status }).eq("id", id)

    if (error) {
      console.log(error)
      alert("Failed to update driver status")
      return
    }

    loadDrivers()
  }

  async function updateDriverStage(id, current_stage) {
    const { error } = await supabase
      .from("drivers")
      .update({ current_stage })
      .eq("id", id)

    if (error) {
      console.log(error)
      alert("Failed to update driver stage")
      return
    }

    loadDrivers()
  }

  function addTruck() {
    if (!newTruckPlate || !newTruckType) return

    setFleet((prev) => [
      {
        truck: newTruckPlate,
        type: newTruckType,
        status: "Available",
      },
      ...prev,
    ])

    setNewTruckPlate("")
    setNewTruckType("")
  }

  function deleteTruck(plate) {
    setFleet((prev) => prev.filter((t) => t.truck !== plate))
  }

  function deleteLoad(id) {
    setLoads((prev) => prev.filter((load) => load.id !== id))
  }

  function renderPlannerForm() {
    return (
      <>
        <div className="form-grid">
          <input placeholder="Load ID" value={loadId} onChange={(e) => setLoadId(e.target.value)} />
          <input placeholder="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          <input placeholder="Start location" value={startLocation} onChange={(e) => setStartLocation(e.target.value)} />
          <input placeholder="End location" value={endLocation} onChange={(e) => setEndLocation(e.target.value)} />

          <select value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Select Driver</option>
            {drivers.map((driverObj) => (
              <option key={driverObj.id} value={driverObj.name}>
                {driverObj.name}
              </option>
            ))}
          </select>

          <select value={truck} onChange={(e) => setTruck(e.target.value)}>
            <option value="">Select Truck</option>
            {fleet.map((truckObj) => (
              <option key={truckObj.truck} value={truckObj.truck}>
                {truckObj.truck}
              </option>
            ))}
          </select>

          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input placeholder="Average speed" value={avgSpeed} onChange={(e) => setAvgSpeed(e.target.value)} />
        </div>

        <button className="primary-btn" onClick={calculateRoute}>
          Calculate Route
        </button>

        <button className="secondary-btn" onClick={saveLoad}>
          <Save size={16} />
          Save Load
        </button>
      </>
    )
  }

  function renderDashboard() {
    return (
      <>
        <section className="stats">
          <div className="stat-card"><span>Active Loads</span><strong>{activeLoads.length}</strong></div>
          <div className="stat-card"><span>Drivers</span><strong>{drivers.length}</strong></div>
          <div className="stat-card"><span>Fleet</span><strong>{fleet.length}</strong></div>
          <div className="stat-card"><span>Alerts</span><strong>{alerts.length}</strong></div>
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <h3>Live Map</h3>
              <span>{activeLoads.length > 0 ? "Live active loads overview" : "Route visualization"}</span>
            </div>

            <RealMap routePoints={routePoints} plannedMarker={plannedMarker} loads={loads} />

            {trackingInfo && (
              <div className="tracking-info">
                <div><strong>Status:</strong> {trackingInfo.status}</div>
                <div><strong>Planned progress:</strong> {trackingInfo.progress}%</div>

                {trackingInfo.delayed && (
                  <div className="delay-warning">
                    <AlertTriangle size={16} />
                    Delay risk detected
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="panel active-loads-panel">
            <div className="panel-header">
              <h3>Active Loads</h3>
              <span>{activeLoads.length} live loads</span>
            </div>

            <div className="active-loads-list">
              {activeLoads.map((load, index) => (
                <button
                  className="active-load-item"
                  key={load.id}
                  onClick={() => trackLoad(load)}
                  style={{ borderLeftColor: COLORS[index % COLORS.length] }}
                >
                  <div>
                    <strong>{load.id}</strong>
                    <span>{load.from} → {load.to}</span>
                  </div>

                  <div>
                    <strong>{load.driver}</strong>
                    <span>{load.truck}</span>
                  </div>

                  <span className={getLoadStatusClass(load.status)}>{load.status}</span>
                </button>
              ))}

              {activeLoads.length === 0 && (
                <div className="empty-alerts">No active loads yet.</div>
              )}
            </div>
          </div>
        </section>

        <section className="panel dashboard-planner-panel">
          <div className="panel-header">
            <h3>Quick Planner</h3>
            <span>Create and save loads</span>
          </div>

          {renderPlannerForm()}
        </section>
      </>
    )
  }

  function renderRoutes() {
    return (
      <>
        <div className="panel">
          <div className="panel-header">
            <h3>Routes</h3>
            <span>Real route calculation</span>
          </div>

          <div style={{ marginBottom: 20 }}>{renderPlannerForm()}</div>

          <div className="routes-layout">
            <div>
              <RealMap routePoints={routePoints} plannedMarker={plannedMarker} />
            </div>

            <div className="route-side">
              <div className="mini-card"><strong>Status</strong><span>{routeStatus}</span></div>
              <div className="mini-card"><strong>Distance</strong><span>{distance ? `${distance} km` : "--"}</span></div>
              <div className="mini-card"><strong>Driving</strong><span>{drivingTime ? formatHours(drivingTime) : "--"}</span></div>
              <div className="mini-card"><strong>Total Journey</strong><span>{totalJourney ? formatHours(totalJourney) : "--"}</span></div>
              <div className="mini-card"><strong>Breaks / Rests</strong><span>{breaks} / {rests}</span></div>
            </div>
          </div>
        </div>

        <div className="panel break-panel">
          <div className="panel-header">
            <h3>Break Schedule</h3>
            <span>Driver break and rest planning</span>
          </div>

          {breakSchedule.length === 0 ? (
            <div className="empty-alerts">Calculate a route to see break schedule.</div>
          ) : (
            <div className="break-list">
              {breakSchedule.map((item, index) => (
                <div className="break-item" key={index}>
                  <div className={item.type === "Break" ? "break-icon" : "rest-icon"}>
                    {item.type === "Break" ? <Coffee size={18} /> : <Bed size={18} />}
                  </div>

                  <div>
                    <strong>{item.type}</strong>
                    <span>{item.text}</span>
                  </div>

                  <em>{formatHours(item.duration)}</em>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  function renderDrivers() {
    return (
      <>
        <div className="panel drivers-panel">
          <div className="panel-header">
            <h3>Drivers</h3>
            <span>Supabase synced driver registry</span>
          </div>

          <div className="driver-form">
            <div className="input-with-icon">
              <Users size={18} />
              <input placeholder="Driver name" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} />
            </div>

            <div className="input-with-icon">
              <Truck size={18} />
              <input placeholder="Assigned truck" value={newDriverTruck} onChange={(e) => setNewDriverTruck(e.target.value)} />
            </div>
          </div>

          <button className="add-driver-btn" onClick={addDriver}>
            <Plus size={18} />
            Add Driver
          </button>

          <div className="drivers-table">
            <div className="drivers-header">
              <span>Driver</span>
              <span>Truck</span>
              <span>Status</span>
              <span>Current Stage</span>
              <span>Action</span>
            </div>

            {drivers.map((driverObj, index) => (
              <div className="drivers-row" key={driverObj.id}>
                <div className="driver-cell">
                  <div className={`driver-avatar ${getAvatarClass(index)}`}>
                    {getInitials(driverObj.name)}
                  </div>
                  <span>{driverObj.name}</span>
                </div>

                <span>{driverObj.truck}</span>

                <span>
                  <select
                    className={`status-pill ${getStatusClass(driverObj.status)}`}
                    value={driverObj.status}
                    onChange={(e) => updateDriverStatus(driverObj.id, e.target.value)}
                  >
                    <option>Available</option>
                    <option>On Duty</option>
                    <option>Break</option>
                    <option>Offline</option>
                  </select>
                </span>

                <span>
                  <div className={`stage-select-wrap ${getStageClass(driverObj.current_stage || "Idle")}`}>
                    <StageIcon stage={driverObj.current_stage || "Idle"} />

                    <select
                      value={driverObj.current_stage || "Idle"}
                      onChange={(e) => updateDriverStage(driverObj.id, e.target.value)}
                    >
                      <option>Idle</option>
                      <option>Loading</option>
                      <option>In Transit</option>
                      <option>Break</option>
                      <option>Rest</option>
                      <option>Completed</option>
                    </select>
                  </div>
                </span>

                <button className="driver-delete-btn" onClick={() => deleteDriver(driverObj.id)}>
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="driver-footer">
            Showing 1 to {drivers.length} of {drivers.length} drivers
          </div>
        </div>

        <div className="panel stage-legend-panel">
          <div className="panel-header">
            <h3>Driver Daily Work Log</h3>
            <span>Loads by driver and day</span>
          </div>

          <div className="daily-log-table">
            <div className="daily-log-header">
              <span>Date</span>
              <span>Driver</span>
              <span>Load</span>
              <span>Route</span>
              <span>Driving</span>
              <span>Total</span>
              <span>Status</span>
            </div>

            {driverDailyLog.map((item, index) => (
              <div className="daily-log-row" key={index}>
                <span>{item.date}</span>
                <span>{item.driver}</span>
                <span>{item.loadId}</span>
                <span>{item.route}</span>
                <span>{item.drivingTime}</span>
                <span>{item.totalJourney}</span>
                <span className={getLoadStatusClass(item.status)}>{item.status}</span>
              </div>
            ))}

            {driverDailyLog.length === 0 && (
              <div className="empty-alerts">No driver work history yet.</div>
            )}
          </div>
        </div>

        <div className="panel stage-legend-panel">
          <div className="panel-header">
            <h3>Stage Legend</h3>
          </div>

          <div className="stage-legend-grid">
            <div className="legend-card stage-transit"><Truck size={18} /><div><strong>In Transit</strong><p>Driver is on the way</p></div></div>
            <div className="legend-card stage-loading"><Box size={18} /><div><strong>Loading</strong><p>Loading or unloading cargo</p></div></div>
            <div className="legend-card stage-break"><Coffee size={18} /><div><strong>Break</strong><p>Driver is on break</p></div></div>
            <div className="legend-card stage-rest"><Bed size={18} /><div><strong>Rest</strong><p>Driver is resting</p></div></div>
            <div className="legend-card stage-idle"><Circle size={18} /><div><strong>Idle</strong><p>No active load</p></div></div>
            <div className="legend-card stage-completed"><CheckCircle size={18} /><div><strong>Completed</strong><p>Load completed</p></div></div>
          </div>
        </div>
      </>
    )
  }

  function renderFleet() {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Fleet</h3>
          <span>Trucks and trailers</span>
        </div>

        <div className="form-grid">
          <input placeholder="Truck Plate" value={newTruckPlate} onChange={(e) => setNewTruckPlate(e.target.value)} />
          <input placeholder="Truck Type" value={newTruckType} onChange={(e) => setNewTruckType(e.target.value)} />
        </div>

        <button className="add-btn" onClick={addTruck} style={{ marginTop: 14 }}>
          <Plus size={16} />
          Add Truck
        </button>

        <div className="table">
          <div className="table-header">
            <span>Truck</span>
            <span>Type</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {fleet.map((truckObj) => (
            <div className="table-row-4" key={truckObj.truck}>
              <span>{truckObj.truck}</span>
              <span>{truckObj.type}</span>
              <span>{truckObj.status}</span>

              <button className="delete-load-btn" onClick={() => deleteTruck(truckObj.truck)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderLoads() {
    const delivered = loads.filter((l) => l.status === "Delivered").length
    const transit = loads.filter((l) => l.status === "In Transit").length
    const delayed = loads.filter((l) => l.status === "Delayed").length

    return (
      <>
        <section className="stats">
          <div className="stat-card"><span>Total Loads</span><strong>{loads.length}</strong></div>
          <div className="stat-card"><span>In Transit</span><strong>{transit}</strong></div>
          <div className="stat-card"><span>Delivered</span><strong>{delivered}</strong></div>
          <div className="stat-card"><span>Delayed</span><strong>{delayed}</strong></div>
        </section>

        <div className="panel">
          <div className="panel-header">
            <h3>Load Management</h3>
            <span>Professional dispatch overview</span>
          </div>

          <div className="loads-table">
            <div className="loads-table-header">
              <span>Load</span>
              <span>Route</span>
              <span>Driver</span>
              <span>Truck</span>
              <span>ETA</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loads.map((load) => (
              <div className="loads-table-row" key={load.id}>
                <div className="load-main">
                  <strong>{load.id}</strong>
                  <small>{load.customer}</small>
                </div>

                <div className="route-cell">
                  <strong>{load.from}</strong>
                  <span>→</span>
                  <strong>{load.to}</strong>
                </div>

                <div>{load.driver}</div>
                <div>{load.truck}</div>

                <div className="eta-cell">
                  <Clock size={14} />
                  {load.totalJourney}
                </div>

                <div>
                  <span className={getLoadStatusClass(load.status)}>{load.status}</span>
                </div>

                <div className="load-actions">
                  <button className="track-btn" onClick={() => trackLoad(load)}>
                    <LocateFixed size={14} />
                    Track
                  </button>

                  <select
                    className="load-status-select"
                    value={load.status}
                    onChange={(e) => updateLoadStatus(load.id, e.target.value)}
                  >
                    <option>Planned</option>
                    <option>Loading</option>
                    <option>In Transit</option>
                    <option>Delayed</option>
                    <option>Delivered</option>
                  </select>

                  <button className="delete-load-btn" onClick={() => deleteLoad(load.id)}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )
  }

  function renderAlerts() {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Alerts</h3>
          <span>Live delay monitoring</span>
        </div>

        <div className="alerts-list">
          {alerts.length === 0 && <div className="empty-alerts">No active alerts.</div>}

          {alerts.map((alert, index) => (
            <div key={index} className={`alert-item alert-${alert.severity}`}>
              <AlertTriangle size={18} />

              <div>
                <strong>{alert.type}</strong>
                <p>{alert.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderPage() {
    if (activePage === "dashboard") return renderDashboard()
    if (activePage === "routes") return renderRoutes()
    if (activePage === "drivers") return renderDrivers()
    if (activePage === "fleet") return renderFleet()
    if (activePage === "loads") return renderLoads()
    if (activePage === "alerts") return renderAlerts()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Truck size={28} />

          <div>
            <h1>Transport TMS</h1>
            <span>Dispatch Platform</span>
          </div>
        </div>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={activePage === item.id ? "nav-active" : ""}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">A</div>

          <div>
            <strong>Admin User</strong>
            <span>administrator</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>{menuItems.find((item) => item.id === activePage)?.label}</h2>
            <p>Modern transport management system</p>
          </div>

          <div className="search">
            <Search size={18} />
            <input placeholder="Search..." />
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  )
}

export default App