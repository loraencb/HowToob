import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

/**
 * Creator Dashboard with analytics:
 * - Line chart for views over last 7 days
 * - Bar chart for subscribers gained over last 30 days
 */
export default function CreatorDashboard() {
  // Mock data for 7 days of views
  const viewsChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Views',
        data: [240, 350, 280, 420, 580, 720, 650],
        borderColor: '#BA190B',
        backgroundColor: 'rgba(186, 25, 11, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#BA190B',
        pointBorderColor: '#13090A',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  }

  // Mock data for 30 days of subscriber gains
  const subsChartData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Subscribers Gained',
        data: [45, 62, 78, 55],
        backgroundColor: '#BA190B',
        borderColor: '#9E1509',
        borderWidth: 1,
        borderRadius: 8,
        hoverBackgroundColor: '#9E1509'
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#F8F9FA',
          font: { size: 12, weight: '500' }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(58, 32, 34, 0.3)' },
        ticks: { color: '#A0A0A0' }
      },
      y: {
        grid: { color: 'rgba(58, 32, 34, 0.3)' },
        ticks: { color: '#A0A0A0' }
      }
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{
        marginBottom: '3rem'
      }}>
        <h1 style={{
          fontFamily: 'var(--font-family-heading)',
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-light)',
          marginBottom: '0.5rem'
        }}>
          Creator Studio
        </h1>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-base)'
        }}>
          Video management, analytics, and earnings
        </p>
      </div>

      {/* Analytics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem',
        marginBottom: '3rem'
      }}>
        {/* Stat Card 1 */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
            margin: '0 0 0.5rem 0'
          }}>
            Total Views
          </p>
          <h2 style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary)',
            margin: 0
          }}>
            3,220
          </h2>
        </div>

        {/* Stat Card 2 */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
            margin: '0 0 0.5rem 0'
          }}>
            Total Subscribers
          </p>
          <h2 style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--font-size-3xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary)',
            margin: 0
          }}>
            2,840
          </h2>
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2rem'
      }}>
        {/* Line Chart - Views */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-light)',
            marginBottom: '1rem'
          }}>
            Total Views (Last 7 Days)
          </h3>
          <div style={{ position: 'relative', height: '300px' }}>
            <Line data={viewsChartData} options={chartOptions} />
          </div>
        </div>

        {/* Bar Chart - Subs */}
        <div style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-family-heading)',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-light)',
            marginBottom: '1rem'
          }}>
            Subs Gained (Last 30 Days)
          </h3>
          <div style={{ position: 'relative', height: '300px' }}>
            <Bar data={subsChartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
