import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Rating,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import {
  ArrowBack,
  Bolt,
  CreditCardOff,
  DeleteOutlined,
  LocationOn,
  OpenInNew,
  Verified,
} from '@mui/icons-material'
import moment from 'moment'
import { useEffect, useState } from 'react'
import upworkApi, { Job, getClientStats } from '@/api/upwork'
import Handshake from '@/icons/Handshake'
import colors from '@/utils/colors'

type Props = {
  job: Job
  isStale?: boolean
  onApply: (job: Job) => void
  onBack?: () => void
  onRemove?: (job: Job) => void
  onSyncStatusChange?: (isSyncing: boolean) => void
  onJobLiveUpdated?: (
    ciphertext: string,
    updates: { connects?: number; proposalsTier?: string }
  ) => void
}

const capitalizeFirst = (string: string) =>
  string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()

const formatBudget = (job: Job): string => {
  if (job.type === 'Hourly') {
    const min = job.hourlyBudget?.min
    const max = job.hourlyBudget?.max
    if (min && max && min !== max) return `$${min}–$${max}/hr`
    if (min) return `$${min}/hr`
    if (max) return `$${max}/hr`
    return 'Hourly (unspecified)'
  }

  const amount = Number(job.amount?.amount)
  if (amount > 0) {
    return `$${amount.toLocaleString()} (Fixed)`
  }

  return 'Fixed-price'
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

const JobDetailPane = (props: Props) => {
  const theme = useTheme()
  const { job } = props
  const clientStats = getClientStats(job.client)
  const isDarkMode = theme.palette.mode === 'dark'

  const [fetchedConnects, setFetchedConnects] = useState<number | null>(
    job.connectPrice && job.connectPrice > 0 && job.connectPrice <= 50
      ? job.connectPrice
      : null
  )
  const [isLoadingConnects, setIsLoadingConnects] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true

    // Check if we need to fetch: if stale, or if connectPrice is missing / invalid
    const needsFetch =
      props.isStale ||
      !job.connectPrice ||
      job.connectPrice <= 0 ||
      job.connectPrice > 50

    if (!needsFetch) {
      setFetchedConnects(job.connectPrice ?? null)
      setIsLoadingConnects(false)
      props.onSyncStatusChange?.(false)
      return
    }

    setFetchedConnects(
      job.connectPrice && job.connectPrice <= 50 ? job.connectPrice : null
    )
    setIsLoadingConnects(true)
    props.onSyncStatusChange?.(true)

    upworkApi
      .fetchJobLiveUpdates(job.ciphertext)
      .then(({ connects, proposalsTier }) => {
        if (!isMounted) return
        setIsLoadingConnects(false)
        props.onSyncStatusChange?.(false)
        const updates: { connects?: number; proposalsTier?: string } = {}

        if (connects && connects > 0 && connects <= 50) {
          setFetchedConnects(connects)
          updates.connects = connects
        }

        if (proposalsTier) {
          updates.proposalsTier = proposalsTier
        }

        props.onJobLiveUpdated?.(job.ciphertext, updates)
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingConnects(false)
          props.onSyncStatusChange?.(false)
        }
      })

    return () => {
      isMounted = false
      props.onSyncStatusChange?.(false)
    }
  }, [job.ciphertext, job.connectPrice, props.isStale])

  return (
    <Box sx={{ position: 'relative' }}>
      {isLoadingConnects && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            height: 3,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        />
      )}
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Top action header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {props.onBack && (
              <Button
                size="small"
                startIcon={<ArrowBack />}
                onClick={props.onBack}
                sx={{ textTransform: 'none', mr: 1 }}
              >
                Back
              </Button>
            )}

            {!job.__isSeen && (
              <Chip
                size="small"
                label="New"
                sx={{
                  fontWeight: 700,
                  backgroundColor: isDarkMode ? colors.orange : colors.warning,
                  color: isDarkMode ? '#fff' : '#000',
                }}
              />
            )}

            <Typography variant="caption" color="textSecondary">
              Posted {moment(job.renewedOn ?? job.createdOn).fromNow()}
            </Typography>

            {isLoadingConnects ? (
              <Chip
                size="small"
                icon={<CircularProgress size={12} color="inherit" />}
                label="Syncing live data..."
                variant="outlined"
                color="info"
                sx={{ height: 22, fontSize: '0.72rem' }}
              />
            ) : props.isStale ? (
              <Chip
                size="small"
                label="Older listing"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.72rem', opacity: 0.7 }}
              />
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {props.onRemove && (
              <Tooltip title="Remove job">
                <IconButton
                  size="small"
                  color="default"
                  aria-label="Remove job"
                  onClick={() => props.onRemove?.(job)}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            <Button
              size="small"
              variant="outlined"
              component="a"
              href={upworkApi.viewUrl(job.ciphertext)}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNew fontSize="small" />}
              sx={{ textTransform: 'none' }}
            >
              View Job
            </Button>

            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => props.onApply(job)}
              startIcon={<Bolt fontSize="small" />}
              endIcon={<OpenInNew fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Apply Now
            </Button>
          </Stack>
        </Box>

        {/* Job Title */}
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 700,
            mb: 2,
            lineHeight: 1.3,
          }}
          dangerouslySetInnerHTML={{ __html: job.title }}
        />

        {/* Key Metric Badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          <Chip
            label={formatBudget(job)}
            color="primary"
            variant={isDarkMode ? 'outlined' : 'filled'}
            sx={{ fontWeight: 600 }}
          />

          {job.proposalsTier && (
            <Chip
              size="medium"
              label={`Proposals: ${job.proposalsTier}`}
              color={getProposalsTierColor(job.proposalsTier)}
              variant="outlined"
              sx={{ fontWeight: 500 }}
            />
          )}

          {job.tierText && (
            <Chip
              size="medium"
              label={`Experience: ${capitalizeFirst(job.tierText)}`}
              variant="outlined"
            />
          )}

          {job.durationLabel && (
            <Chip
              size="medium"
              label={`Duration: ${capitalizeFirst(job.durationLabel)}`}
              variant="outlined"
            />
          )}

          {job.engagement && job.engagement !== 'not_sure' && (
            <Chip
              size="medium"
              label={`Engagement: ${job.engagement}`}
              variant="outlined"
            />
          )}

          {/* Dynamic Connects Badge */}
          {fetchedConnects !== null && fetchedConnects > 0 ? (
            <Tooltip
              title={`At $0.15 USD per Connect, this proposal costs ~$${(fetchedConnects * 0.15).toFixed(2)} USD`}
            >
              <Chip
                size="medium"
                label={`${fetchedConnects} Connects (~$${(fetchedConnects * 0.15).toFixed(2)})`}
                variant="outlined"
                color="primary"
              />
            </Tooltip>
          ) : isLoadingConnects ? (
            <Chip
              size="medium"
              label="Checking connects..."
              variant="outlined"
              sx={{ opacity: 0.6 }}
            />
          ) : null}
        </Box>

        {/* Previous Client Banner */}
        {job.clientRelation && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderColor: 'info.main',
              backgroundColor: isDarkMode
                ? 'rgba(2, 144, 209, 0.1)'
                : 'rgba(2, 144, 209, 0.05)',
            }}
          >
            <Handshake color="info" fontSize="large" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Previous Client
              </Typography>
              <Typography variant="caption" color="textSecondary">
                You worked with this client previously.
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Client Intelligence Dossier */}
        {job.client && (
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              backgroundColor: isDarkMode ? '#161c24' : '#fafafa',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'text.secondary',
                mb: 2,
              }}
            >
              About the Client
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: '1fr 1fr 1fr',
                },
                gap: 2,
              }}
            >
              {/* Payment & Rating */}
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Payment & Rating
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  {job.client.paymentVerificationStatus === 1 ? (
                    <>
                      <Verified color="info" fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Payment verified
                      </Typography>
                    </>
                  ) : (
                    <>
                      <CreditCardOff color="action" fontSize="small" />
                      <Typography variant="body2" color="textSecondary">
                        Payment unverified
                      </Typography>
                    </>
                  )}
                </Box>

                {job.client.totalFeedback > 0 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      mt: 0.5,
                    }}
                  >
                    <Rating
                      readOnly
                      precision={0.1}
                      size="small"
                      value={job.client.totalFeedback}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {job.client.totalFeedback.toFixed(1)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Total Spend & Location */}
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Spend & Location
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {job.client.totalSpent
                    ? `${Intl.NumberFormat('en-US', {
                        currency: 'USD',
                        style: 'currency',
                        maximumFractionDigits: 0,
                      }).format(job.client.totalSpent)} spent`
                    : '$0 spent'}
                </Typography>

                {job.client.location?.country && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mt: 0.5,
                    }}
                  >
                    <LocationOn color="error" sx={{ fontSize: 16 }} />
                    {job.client.location.country}
                  </Typography>
                )}
              </Box>

              {/* Hiring Track Record */}
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Hiring History
                </Typography>
                {clientStats && (
                  <>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, mt: 0.5 }}
                    >
                      {clientStats.hireRate}% hire rate
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {clientStats.openJobs} open job
                      {clientStats.openJobs === 1 ? '' : 's'} •{' '}
                      {clientStats.totalPostedJobs} posted
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          </Paper>
        )}

        {/* Job Description */}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            color: 'text.secondary',
            mb: 1.5,
          }}
        >
          Description
        </Typography>

        <Typography
          variant="body1"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.7,
            fontSize: '0.95rem',
            mb: 3,
          }}
          dangerouslySetInnerHTML={{ __html: job.description }}
        />

        {/* Skills & Expertise */}
        {job.attrs && job.attrs.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'text.secondary',
                mb: 1.5,
              }}
            >
              Skills & Expertise
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {job.attrs.map((attr) => (
                <Chip
                  key={attr.prettyName}
                  label={attr.prettyName}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  )
}

export default JobDetailPane
