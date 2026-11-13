import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Typography,
  useTheme,
} from '@mui/material'
import moment from 'moment'
import { Job, getClientStats } from '@/api/upwork'
import Handshake from '@/icons/Handshake'
import colors from '@/utils/colors'

type Props = {
  job: Job
  isSelected: boolean
  isUnseen: boolean
  isStale?: boolean
  isLoading?: boolean
  onClick: () => void
}

const formatBudget = (job: Job): string => {
  if (job.type === 'Hourly') {
    const min = job.hourlyBudget?.min
    const max = job.hourlyBudget?.max
    if (min && max && min !== max) return `$${min}–$${max}/hr`
    if (min) return `$${min}/hr`
    if (max) return `$${max}/hr`
    return 'Hourly'
  }

  const amount = Number(job.amount?.amount)
  if (amount > 0) {
    return `$${amount.toLocaleString()}`
  }

  return 'Fixed'
}

const getProposalsTierColor = (
  tier: string | null
): 'success' | 'info' | 'warning' | 'default' => {
  if (!tier) return 'default'
  const lower = tier.toLowerCase()
  if (lower.includes('less than 5') || lower === '< 5') return 'success'
  if (lower.includes('5 to 10')) return 'info'
  if (lower.includes('10 to 15') || lower.includes('15 to 20')) return 'warning'
  return 'default'
}

const JobListItem = (props: Props) => {
  const theme = useTheme()
  const { job, isSelected, isUnseen, isStale, isLoading } = props
  const clientStats = getClientStats(job.client)
  const isDarkMode = theme.palette.mode === 'dark'

  const isDimmed = isStale && !isSelected && !isLoading

  const clientSnippet = (() => {
    if (!job.client) return null
    const parts = []
    if (job.client.totalFeedback > 0) {
      parts.push(`⭐ ${job.client.totalFeedback.toFixed(1)}`)
    }
    if (job.client.totalSpent) {
      parts.push(
        Intl.NumberFormat('en-US', {
          notation: 'compact',
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(job.client.totalSpent)
      )
    }
    if (clientStats && clientStats.hireRate > 0) {
      parts.push(`${clientStats.hireRate}% hire`)
    }
    if (job.client.location?.country) {
      parts.push(job.client.location.country)
    }
    return parts.join(' • ')
  })()

  return (
    <Paper
      variant="outlined"
      onClick={props.onClick}
      sx={{
        p: 2,
        mb: 1.5,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
        borderRadius: 2,
        opacity: isDimmed ? 0.6 : 1,
        filter: isDimmed ? 'grayscale(35%)' : 'none',
        borderColor: isSelected
          ? isDarkMode
            ? '#fff'
            : '#000'
          : isDimmed
            ? isDarkMode
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(0, 0, 0, 0.05)'
            : isDarkMode
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(0, 0, 0, 0.08)',
        borderLeftWidth: isSelected ? 4 : isUnseen ? 4 : 1,
        borderLeftColor: isSelected
          ? isDarkMode
            ? '#fff'
            : '#000'
          : isUnseen
            ? isDarkMode
              ? colors.orange
              : colors.warning
            : undefined,
        backgroundColor: isSelected
          ? isDarkMode
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(0, 0, 0, 0.03)'
          : isUnseen
            ? isDarkMode
              ? 'rgba(252, 119, 3, 0.08)'
              : 'rgba(255, 255, 198, 0.5)'
            : isDimmed
              ? isDarkMode
                ? 'rgba(255, 255, 255, 0.015)'
                : 'rgba(0, 0, 0, 0.015)'
              : 'background.paper',
        '&:hover': {
          opacity: 1,
          filter: 'none',
          borderColor: isDarkMode ? '#fff' : '#000',
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* Title + Previous client */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          mb: 0.75,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            fontSize: '0.925rem',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            color: isDimmed ? 'text.secondary' : 'text.primary',
          }}
          dangerouslySetInnerHTML={{ __html: job.title }}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexShrink: 0,
          }}
        >
          {isLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={13} thickness={5} color="primary" />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.675rem',
                  color: 'primary.main',
                  fontWeight: 600,
                }}
              >
                Syncing
              </Typography>
            </Box>
          )}

          {!isLoading && isStale && !isSelected && (
            <Chip
              size="small"
              label="Outdated"
              variant="outlined"
              sx={{
                fontSize: '0.65rem',
                height: 18,
                color: 'text.secondary',
                borderColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.15)'
                  : 'rgba(0, 0, 0, 0.15)',
              }}
            />
          )}

          {job.clientRelation && <Handshake color="info" fontSize="small" />}
        </Box>
      </Box>

      {/* Budget & Time Meta */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          mb: 0.75,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: isDarkMode ? '#fff' : '#000',
          }}
        >
          {formatBudget(job)}
        </Typography>

        <Typography variant="caption" color="textSecondary">
          •
        </Typography>

        <Typography variant="caption" color="textSecondary">
          {job.type}
        </Typography>

        <Typography variant="caption" color="textSecondary">
          •
        </Typography>

        <Typography variant="caption" color="textSecondary">
          {moment(job.renewedOn ?? job.createdOn).fromNow()}
        </Typography>
      </Box>

      {/* Client Quick Stats */}
      {clientSnippet && (
        <Typography
          variant="caption"
          color="textSecondary"
          sx={{
            display: 'block',
            mb: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {clientSnippet}
        </Typography>
      )}

      {/* Tags & Proposals Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {job.proposalsTier && (
            <Chip
              size="small"
              label={job.proposalsTier}
              color={getProposalsTierColor(job.proposalsTier)}
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}

          {Boolean(
            job.connectPrice && job.connectPrice > 0 && job.connectPrice <= 50
          ) && (
            <Chip
              size="small"
              label={`${job.connectPrice} connects (~$${((job.connectPrice || 0) * 0.15).toFixed(2)})`}
              variant="outlined"
              sx={{
                fontSize: '0.7rem',
                height: 20,
                color: isDarkMode ? '#90caf9' : '#1976d2',
                borderColor: isDarkMode
                  ? 'rgba(144, 202, 249, 0.4)'
                  : 'rgba(25, 118, 210, 0.4)',
              }}
            />
          )}
        </Box>

        {/* First 2 skill tags */}
        <Box sx={{ display: 'flex', gap: 0.5, overflow: 'hidden' }}>
          {(job.attrs ?? []).slice(0, 2).map((attr) => (
            <Chip
              key={attr.prettyName}
              label={attr.prettyName}
              size="small"
              sx={{
                fontSize: '0.7rem',
                height: 20,
                backgroundColor: isDarkMode
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.04)',
              }}
            />
          ))}
        </Box>
      </Box>
    </Paper>
  )
}

export default JobListItem
