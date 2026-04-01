'use client'

// ====================== IMPORTS ========================= //
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../lib/supabase' //connects frontend to database
import { ChartOptions } from 'chart.js'
import { CSSProperties } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend
} from 'chart.js'

import zoomPlugin from 'chartjs-plugin-zoom'
//import { Line } from 'react-chartjs-2'
const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), {
  ssr: false
})

// ====================== HOME COMPONENT ========================= //
export default function Home() {
  const [data, setData] = useState<any[]>([])               //Stores sensor data from database
  const [intervalTime, setIntervalTime] = useState(2000)    //How often to fetch data (ms)
  const [timeRange, setTimeRange] = useState(1)            //How much past data to analyze (minutes), Used for filtering


useEffect(() => {
  async function loadChartPlugins() {
    const zoomPlugin = (await import('chartjs-plugin-zoom')).default

    ChartJS.register(
      LineElement,
      CategoryScale,
      LinearScale,
      PointElement,
      Legend,
      zoomPlugin
    )
  }

  // Load Chart.js plugins dynamically

  loadChartPlugins()
}, [])
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, intervalTime)
    return () => clearInterval(interval)
  }, [intervalTime])

  async function fetchData() {
    const { data, error } = await supabase
      .from('accelerometer_data')                      //Query Supabase table: accelerometer_data
      .select('*')
      .order('timestamp', { ascending: false })        //Sort descending (latest first)
      .limit(50)                                       //Get latest 50 rows
    if (!error && data) {
      setData(data.reverse())                          //Reverse → so chart shows old → new
    }
  }

  function createOptions(values: number[]): ChartOptions<'line'> {
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 15
        }
      },
      y: {
        min: min - 1,
        max: max + 1,
        ticks: {
          stepSize: (max - min) / 5 || 1
        }
      }
    }
  }
}

  //FILTER DATA
  const filteredData = data.filter((item) => {
  const now = Date.now()
  const itemTime = item.timestamp*1000
  return now - itemTime <= timeRange * 60 * 1000
  }) 

  //STATS
  function computeStats(values: number[]) {
    if (values.length === 0) return { avg: 0, min: 0, max: 0 }
    const sum = values.reduce((a, b) => a + b, 0)
    return {
      avg: (sum / values.length).toFixed(2),
      min: Math.min(...values).toFixed(2),
      max: Math.max(...values).toFixed(2)
    }
  }

  const xStats = computeStats(filteredData.map(d => d["x-axis"]))
  const yStats = computeStats(filteredData.map(d => d["y-axis"]))
  const zStats = computeStats(filteredData.map(d => d["z-axis"]))
  const tStats = computeStats(filteredData.map(d => d.temperature))

  //CSV DOWNLOAD
  function downloadCSV() {
    let csv = "Axis,Average,Min,Max\n"
    csv += `X,${xStats.avg},${xStats.min},${xStats.max}\n`
    csv += `Y,${yStats.avg},${yStats.min},${yStats.max}\n`
    csv += `Z,${zStats.avg},${zStats.min},${zStats.max}\n`
    csv += `Temp,${tStats.avg},${tStats.min},${tStats.max}\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = 'report.csv'
    a.click()
  }

  //PDF DOWNLOAD
  function downloadPDF() {
  const doc = new jsPDF()

  doc.setFontSize(18)
  doc.text("Sensor Data Report", 14, 20)

  doc.setFontSize(12)
  doc.text(`Time Range: Last ${timeRange} minutes`, 14, 30)

  autoTable(doc, {
    startY: 40,
    head: [['Axis', 'Average', 'Min', 'Max']],
    body: [
      ['X', xStats.avg, xStats.min, xStats.max],
      ['Y', yStats.avg, yStats.min, yStats.max],
      ['Z', zStats.avg, zStats.min, zStats.max],
      ['Temp', tStats.avg, tStats.min, tStats.max],
    ]
  })

  doc.save("report.pdf")
}

  //CHART DATA (IMPORTANT: filteredData)
const xValues = filteredData.map(d => d["x-axis"] ?? 0)
const yValues = filteredData.map(d => d["y-axis"] ?? 0)
const zValues = filteredData.map(d => d["z-axis"] ?? 0)
const tValues = filteredData.map(d => d["temperature"] ?? 0)

const labels = filteredData.map((item) =>
  new Date(item.timestamp * 1000).toLocaleTimeString()
)

  const xChartData = {
  labels,
  datasets: [
    {
      label: 'X Axis',
      data:  xValues,
      borderColor: 'red',
      tension: 0.3
    }
  ]
}

const yChartData = {
  labels,
  datasets: [
    {
      label: 'Y Axis',
      data: yValues,
      borderColor: 'green',
      tension: 0.3
    }
  ]
}

const zChartData = {
  labels,
  datasets: [
    {
      label: 'Z Axis',
      data: zValues,
      borderColor: 'blue',
      tension: 0.3
    }
  ]
}

  //TEMPERATURE GRAPH
  const tempData = {
    labels,
    datasets: [
      {
        label: 'Temperature',
        data: filteredData.map((item) => item.temperature),
        borderColor: 'orange',
        tension: 0.3
      }
    ]
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>

      {/* HEADER */}
      <h1 style={{ textAlign: "center" }}>SENSOR DATA DASHBOARD</h1>

      {/* INTRO */}
      <p style={{ textAlign: "center", color: "gray", marginBottom: "30px" }}>
        This dashboard visualizes real-time accelerometer and temperature data.
        You can monitor signals, control update frequency, and generate reports.
      </p>
      

      {/* MAIN LAYOUT */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "20px"
      }}>

        {/* LEFT SIDE */}
       <div style={{ flex: 3, minWidth: "300px" }}>

  {/* X GRAPH */}
  <div style={card}>
    <h3>X Axis</h3>
    <div style={{ height: "250px" }}>
      <Line data={xChartData} options={createOptions( xValues)} />
    </div>
  </div>

  {/* Y GRAPH */}
  <div style={{ ...card, marginTop: "20px" }}>
    <h3>Y Axis</h3>
    <div style={{ height: "250px" }}>
      <Line data={yChartData} options={createOptions(yValues)} />
    </div>
  </div>

  {/* Z GRAPH */}
  <div style={{ ...card, marginTop: "20px" }}>
    <h3>Z Axis</h3>
    <div style={{ height: "250px" }}>
      <Line data={zChartData} options={createOptions(zValues)} />
    </div>
  </div>

  {/* TEMP GRAPH*/}
  <div style={{ ...card, marginTop: "20px" }}>
    <div style={{ height: "300px" }}>
      <Line data={tempData} options={createOptions(tValues)} />
    </div>
  </div>

</div>

        {/* RIGHT SIDE CONTROLS */}
        <div style={{ flex: 1, minWidth: "250px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* INTERVAL */}
          <div style={card}>
            <h3>Update Interval</h3>
            <input
              type="number"
              value={intervalTime / 1000}
              onChange={(e) => setIntervalTime(Number(e.target.value) * 1000)}
            /> sec
          </div>

          {/* TIME RANGE */}
          <div style={card}>
            <h3>Statistics Range</h3>
            <select onChange={(e) => setTimeRange(Number(e.target.value))}>
              <option value={10}>10 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>

          {/* DOWNLOAD  FILES */}
           <h3>Download Report</h3>
          <div style={card}>
            
           
            <button onClick={downloadCSV} style={buttonStyle}>
              ⬇ Download CSV
            </button>
          </div>
          
          <div style={card}>
            
            <button onClick={downloadPDF} style={buttonStyle}>
  📄 Download PDF
</button>

          </div>


          

           {/* STATS TABLE */}
      <div style={{ marginTop: "30px" }}>
  <h2 style={{ marginBottom: "10px" }}>Statistics</h2>

  <table style={tableStyle}>
    <thead>
      <tr style={headerRow}>
        <th style={thStyle}>Axis</th>
        <th style={thStyle}>Average</th>
        <th style={thStyle}>Min</th>
        <th style={thStyle}>Max</th>
      </tr>
    </thead>

    <tbody>
      <tr style={rowStyle}>
        <td style={tdStyle}>X</td>
        <td style={tdStyle}>{xStats.avg}</td>
        <td style={tdStyle}>{xStats.min}</td>
        <td style={tdStyle}>{xStats.max}</td>
      </tr>

      <tr style={altRowStyle}>
        <td style={tdStyle}>Y</td>
        <td style={tdStyle}>{yStats.avg}</td>
        <td style={tdStyle}>{yStats.min}</td>
        <td style={tdStyle}>{yStats.max}</td>
      </tr>

      <tr style={rowStyle}>
        <td style={tdStyle}>Z</td>
        <td style={tdStyle}>{zStats.avg}</td>
        <td style={tdStyle}>{zStats.min}</td>
        <td style={tdStyle}>{zStats.max}</td>
      </tr>

      <tr style={altRowStyle}>
        <td style={tdStyle}>Temp</td>
        <td style={tdStyle}>{tStats.avg}</td>
        <td style={tdStyle}>{tStats.min}</td>
        <td style={tdStyle}>{tStats.max}</td>
      </tr>
    </tbody>
  </table>
</div>

        </div>
      </div>  
    </div>
  )
}

// styles
const card = {
  background: "#f8fbfdfb",
  padding: "15px",
  borderRadius: "10px",
  boxShadow: "0px 4px 10px rgba(63, 82, 95, 0.94)"
}

const buttonStyle = {
  padding: "12px",
  background: "linear-gradient(135deg, #007bff, #0056b3)",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  width: "100%"
}

const tableStyle : CSSProperties= {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0",
  border: "2px solid #0b3d91", // dark blue border
  borderRadius: "10px",
  overflow: "hidden",
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
}

const headerRow : CSSProperties= {
  background: "linear-gradient(135deg, #0b3d91, #1e5bd1)"
}

const thStyle : CSSProperties = {
  padding: "12px",
  color: "white",
  fontWeight: "bold",
  textAlign: "center",
  fontSize: "16px",
  borderBottom: "2px solid #0b3d91"
}

const tdStyle : CSSProperties = {
  padding: "12px",
  textAlign: "center",
  borderBottom: "1px solid #ddd",
  borderRight: "1px solid #0b3d91"
}

const rowStyle : CSSProperties= {
  backgroundColor: "#ffffff",
  transition: "0.3s"
}

const altRowStyle : CSSProperties = {
  backgroundColor: "#f4f7ff"
}


