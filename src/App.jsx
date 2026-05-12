import { useState, useEffect } from "react"
import {
  Truck, Map, Users, Package, AlertTriangle, Route, Search, Clock, Plus,
  Save, Trash2, Circle, Box, Coffee, Bed, CheckCircle, LocateFixed
} from "lucide-react"

import {
  MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker
} from "react-leaflet"

import "leaflet/dist/leaflet.css"
import "./App.css"

function formatHours(hours) {
  const totalMinutes = Math.round(hours * 60)
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

  while (remaining > 0) {
    const driveChunk = Math.min(
      remaining,
      breakEvery - drivenSinceBreak,
      dailyDriveLimit - drivenToday
    )

    if (driveChunk > 0) {
      remaining -= driveChunk
      total += driveChunk
      drivenToday += driveChunk
      drivenSinceBreak += driveChunk
    }

    if (remaining <= 0) break

    if (drivenToday >= dailyDriveLimit) {
      total += dailyRest
      rests += 1
      drivenToday = 0
      drivenSinceBreak = 0
      continue
    }

    if (drivenSinceBreak >= breakEvery) {
      total += breakDuration
      breaks += 1
      drivenSinceBreak = 0
    }
  }

  return { total, breaks, rests }
}

function parseCoordinates(input) {
  const match = input.trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/)
  if (!match) return null
  return { lat: parseFloat(match[1]), lon: parseFloat(match[3]) }
}

function RealMap({ routePoints, plannedMarker }) {
  const defaultCenter = [53.8, 23.8]
  const center =
    routePoints.length > 0
      ? routePoints[Math.floor(routePoints.length / 2)]
      : defaultCenter

  return (
    <div className="real-map">
      <MapContainer
        center={center}
        zoom={routePoints.length ? 6 : 5}
        scrollWheelZoom={true}
        className="leaflet-map"
        key={routePoints.length ? `${center[0]}-${center[1]}-${plannedMarker ? "track" : "route"}` : "default"}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {routePoints.length >= 2 && (
          <>
            <Polyline
              positions={routePoints}
              pathOptions={{ color: "#1578c8", weight: 5 }}
            />

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
  const [routeStatus, setRouteStatus] = useState("Ready")

  const [loads, setLoads] = useState(() => {
    const saved = localStorage.getItem("transport_tms_loads")
    return saved ? JSON.parse(saved) : []
  })

  const [drivers, setDrivers] = useState(() => {
    const saved = localStorage.getItem("transport_tms_drivers")
    return saved
      ? JSON.parse(saved)
      : [
          { id: 1, name: "Mindaugas Petrauskas", truck: "Volvo FHH:433", status: "Available", stage: "Idle" },
          { id: 2, name: "Jonas Petrauskas", truck: "Scania S:ABC123", status: "On Duty", stage: "In Transit" },
          { id: 3, name: "Marius Kazlauskas", truck: "MAN TGX:KLM889", status: "On Duty", stage: "Loading" },
        ]
  })

  const [fleet, setFleet] = useState(() => {
    const saved = localStorage.getItem("transport_tms_fleet")
    return saved
      ? JSON.parse(saved)
      : [
          { truck: "Volvo FHH:433", type: "Volvo FH", status: "Available" },
          { truck: "Scania S:ABC123", type: "Scania S", status: "Available" },
        ]
  })

  useEffect(() => {
    localStorage.setItem("transport_tms_loads", JSON.stringify(loads))
  }, [loads])

  useEffect(() => {
    localStorage.setItem("transport_tms_drivers", JSON.stringify(drivers))
  }, [drivers])

  useEffect(() => {
    localStorage.setItem("transport_tms_fleet", JSON.stringify(fleet))
  }, [fleet])

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <Map size={18} /> },
    { id: "routes", label: "Routes", icon: <Route size={18} /> },
    { id: "drivers", label: "Drivers", icon: <Users size={18} /> },
    { id: "fleet", label: "Fleet", icon: <Truck size={18} /> },
    { id: "loads", label: "Loads", icon: <Package size={18} /> },
    { id: "alerts", label: "Alerts", icon: <AlertTriangle size={18} /> },
  ]

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

  function getInitials(name) {
    return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
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
      setRouteStatus("Ready")
    } catch (error) {
      console.log(error)
      alert("Route calculation error")
      setRouteStatus("Ready")
    }
  }

  async function trackLoad(load) {
    const route = await getRoute(load.from, load.to)

    if (!route) {
      alert("Unable to track this load route")
      return
    }

    const points = route.geometry.coordinates.map((coord) => [coord[1], coord[0]])
    setRoutePoints(points)

    if (!load.startTime || !load.totalJourneyHours) {
      setPlannedMarker(points[0])
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

    const index = Math.floor(progress * (points.length - 1))
    setPlannedMarker(points[index])

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

    if (!distance || !drivingTime || !totalJourney) {
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
    }

    setLoads((prev) => [newLoad, ...prev])
    setLoadId("")
    setCustomer("")
    setDriver("")
    setTruck("")
  }

  function addDriver() {
    if (!newDriverName || !newDriverTruck) return

    setDrivers((prev) => [
      { id: Date.now(), name: newDriverName, truck: newDriverTruck, status: "Available", stage: "Idle" },
      ...prev,
    ])

    setNewDriverName("")
    setNewDriverTruck("")
  }

  function deleteDriver(id) {
    setDrivers((prev) => prev.filter((d) => d.id !== id))
  }

  function addTruck() {
    if (!newTruckPlate || !newTruckType) return

    setFleet((prev) => [
      { truck: newTruckPlate, type: newTruckType, status: "Available" },
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
          <div className="stat-card"><span>Active Loads</span><strong>{loads.length}</strong></div>
          <div className="stat-card"><span>Drivers</span><strong>{drivers.length}</strong></div>
          <div className="stat-card"><span>Fleet</span><strong>{fleet.length}</strong></div>
          <div className="stat-card"><span>Alerts</span><strong>{alerts.length}</strong></div>
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <h3>Live Map</h3>
              <span>{trackingInfo ? "Tracking selected load" : "Route visualization"}</span>
            </div>

            <RealMap routePoints={routePoints} plannedMarker={plannedMarker} />

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

          <div className="panel">
            <div className="panel-header">
              <h3>Quick Planner</h3>
              <span>Create and save loads</span>
            </div>

            {renderPlannerForm()}
          </div>
        </section>
      </>
    )
  }

  function renderRoutes() {
    return (
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
    )
  }

  function renderDrivers() {
    return (
      <>
        <div className="panel drivers-panel">
          <div className="panel-header">
            <h3>Drivers</h3>
            <span>Driver registry</span>
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
                    onChange={(e) =>
                      setDrivers((prev) =>
                        prev.map((d) =>
                          d.id === driverObj.id ? { ...d, status: e.target.value } : d
                        )
                      )
                    }
                  >
                    <option>Available</option>
                    <option>On Duty</option>
                    <option>Break</option>
                    <option>Offline</option>
                  </select>
                </span>

                <span>
                  <div className={`stage-select-wrap ${getStageClass(driverObj.stage || "Idle")}`}>
                    <StageIcon stage={driverObj.stage || "Idle"} />

                    <select
                      value={driverObj.stage || "Idle"}
                      onChange={(e) =>
                        setDrivers((prev) =>
                          prev.map((d) =>
                            d.id === driverObj.id ? { ...d, stage: e.target.value } : d
                          )
                        )
                      }
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
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Loads</h3>
          <span>Saved load management</span>
        </div>

        <div className="loads-grid">
          {loads.map((load) => (
            <div className="load-card" key={load.id}>
              <div className="load-top">
                <strong>{load.id}</strong>
                <span>{load.status}</span>
              </div>

              <p><b>{load.customer}</b></p>
              <p>{load.from} → {load.to}</p>
              <p>{load.driver} • {load.truck}</p>

              <div className="load-info">
                <div><Clock size={14} />{load.drivingTime}</div>
                <div><Route size={14} />{load.totalJourney}</div>
              </div>

              <p>{load.distance}</p>

              <div className="status-actions">
                <button className="track-btn" onClick={() => trackLoad(load)}>
                  <LocateFixed size={14} />
                  Track
                </button>

                {["Planned", "Loading", "In Transit", "Delayed", "Delivered"].map((status) => (
                  <button
                    key={status}
                    onClick={() =>
                      setLoads((prev) =>
                        prev.map((l) => (l.id === load.id ? { ...l, status } : l))
                      )
                    }
                    className={load.status === status ? "status-active" : ""}
                  >
                    {status}
                  </button>
                ))}

                <button className="delete-load-btn" onClick={() => deleteLoad(load.id)}>
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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