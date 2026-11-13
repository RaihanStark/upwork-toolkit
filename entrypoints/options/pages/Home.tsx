import { browser } from '#imports'
import upworkApi, { Job } from '@/api/upwork'
import Storage, { StorageInterface } from '@/contexts/storage'
import useMediaQuery from '@/hooks/useMediaQuery'
import GirlReading from '@/icons/GirlReading'
import alerts, { Alert } from '@/utils/alerts'
import colors from '@/utils/colors'
import { ErrorType } from '@/utils/errors'
import extension from '@/utils/extension'
import notifications from '@/utils/notifications'
import {
  AlertTitle,
  Box,
  Button,
  Alert as MuiAlert,
  Paper,
  Typography,
} from '@mui/material'
import { useSnackbar } from 'notistack'
import { useContext, useEffect, useMemo, useState } from 'react'
import JobDetailPane from '../JobDetailPane'
import JobListItem from '../JobListItem'
import { eventEmitter, Event } from '@/utils/events'

const alertInterval = extension.debugEnabled
  ? 10 * 1000 // 10 seconds
  : 24 * 60 * 60 * 1000 // 24 hours

const Home = () => {
  const { enqueueSnackbar } = useSnackbar()
  const storage = useContext<StorageInterface>(Storage)
  const { isDesktop } = useMediaQuery()

  const [debugError, setDebugError] = useState<any>([])
  const [unseenIds, setUnseenIds] = useState<string[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const jobsHash = Array.isArray(storage.jobs)
    ? storage.jobs
        .map((job) => job.ciphertext)
        .sort()
        .join('/')
    : ''

  const lastCycleError = storage.globalState.lastCycleError

  const loginAttempted =
    storage.globalState.lastLoginAttemptAt &&
    storage.globalState.lastLoginAttemptAt + 60000 > Date.now()

  const captchaAttempted =
    storage.globalState.lastCaptchaAttemptAt &&
    storage.globalState.lastCaptchaAttemptAt + 60000 > Date.now()

  const readAlertIds = [
    // Old alerts storage property (readAlertIds), do not use it anywhere else
    ...storage.globalState.readAlertIds,
    ...storage.globalState.readAlerts.map((alert) => alert.id),
  ]

  const unreadAlerts = alerts.filter(
    (alert) => !readAlertIds.includes(alert.id)
  )

  const lastReadAlert =
    storage.globalState.readAlerts.length > 0
      ? storage.globalState.readAlerts.slice(-1)[0]
      : null

  const unreadAlert =
    !lastReadAlert || lastReadAlert.read_at + alertInterval < Date.now()
      ? unreadAlerts[0]
      : null

  const onAlertClose = (alert: Alert) =>
    storage.setState({
      readAlerts: [
        ...storage.globalState.readAlerts,
        { id: alert.id, read_at: Date.now() },
      ],
    })

  const markJobAsRead = async (ciphertext: string) => {
    setUnseenIds((ids) => ids.filter((id) => id !== ciphertext))
    await storage.setJobs((jobs) =>
      jobs.map((job) =>
        job.ciphertext === ciphertext ? { ...job, __isSeen: true } : job
      )
    )
  }

  const handleApply = (job: Job) => {
    storage.globalState.openProposalPage &&
      window.open(upworkApi.proposalUrl(job.ciphertext), '_blank')

    window.open(upworkApi.viewUrl(job.ciphertext), '_blank')

    markJobAsRead(job.ciphertext)
  }

  const handleSelectJob = (job: Job) => {
    setSelectedJobId(job.ciphertext)
    if (unseenIds.includes(job.ciphertext)) {
      markJobAsRead(job.ciphertext)
    }
  }

  const markAllAsRead = async () => {
    setUnseenIds([])
    await storage.setJobs((jobs) =>
      jobs.map((job) => ({ ...job, __isSeen: true }))
    )
  }

  const handleConnectPriceFetched = (ciphertext: string, connects: number) => {
    storage.setJobs((jobs) =>
      jobs.map((j) =>
        j.ciphertext === ciphertext ? { ...j, connectPrice: connects } : j
      )
    )
  }

  const hasUnreadJobs =
    unseenIds.length > 0 || storage.jobs.some((job) => !job.__isSeen)

  const jobs = Array.isArray(storage.jobs) ? storage.jobs : []

  // Current selected job (defaults to first job on desktop)
  const selectedJob = useMemo(() => {
    if (selectedJobId) {
      const found = jobs.find((j) => j.ciphertext === selectedJobId)
      if (found) return found
    }
    return isDesktop && jobs.length > 0 ? jobs[0] : null
  }, [jobs, selectedJobId, isDesktop])

  const renderAlert = () => {
    if (!storage.globalState.enabled) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Notifications are turned off</AlertTitle>

          <p>Click below to start receiving notifications.</p>

          <Button
            variant="contained"
            onClick={() => {
              storage.setState({ enabled: true })
              browser.action.setBadgeText({ text: '' })
              enqueueSnackbar('Notifications are enabled', {
                variant: 'success',
              })
            }}
          >
            Enable notifications
          </Button>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.FORBIDDEN && !captchaAttempted) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Bot detection</AlertTitle>
          <p>
            Upwork blocked request with bot-detection challenge. Solve the
            challenge on the Upwork website to continue receiving notifications.
          </p>

          <Button
            variant="contained"
            onClick={() => {
              storage.setState({
                lastCaptchaAttemptAt: Date.now(),
              })

              browser.tabs.create({
                url: 'https://www.upwork.com/nx/find-work',
              })
            }}
          >
            Solve Challenge
          </Button>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.UNAUTHENTICATED && !loginAttempted) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Log in to Upwork</AlertTitle>
          <p>
            Extension will not be able to fetch jobs without being logged in.
          </p>

          <Button
            variant="contained"
            onClick={() => {
              storage.setState({
                lastLoginAttemptAt: Date.now(),
              })

              browser.tabs.create({
                url: 'https://www.upwork.com/ab/account-security/login',
              })
            }}
          >
            Log in
          </Button>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.UNAUTHENTICATED && loginAttempted) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Did you log in?</AlertTitle>
          <p>
            It might take some time for the extension to pick up on the session.
            Try reloading the page.
          </p>

          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </MuiAlert>
      )
    }

    if (unreadAlert) {
      return (
        <MuiAlert
          sx={{ mb: 3 }}
          onClose={() => onAlertClose(unreadAlert)}
          severity={unreadAlert.severity}
        >
          {unreadAlert.title && <AlertTitle>{unreadAlert.title}</AlertTitle>}

          <Box>
            {unreadAlert.renderBody({
              onInteracted: () => onAlertClose(unreadAlert),
            })}
          </Box>
        </MuiAlert>
      )
    }
  }

  const alert = renderAlert()

  useEffect(() => {
    if (!storage.globalState.enabled) {
      browser.action.setBadgeText({ text: 'OFF' })
      browser.action.setBadgeBackgroundColor({ color: colors.orange })
      return
    }

    if (!lastCycleError) {
      notifications.clearAll()
    }
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    const unseenJobIds = storage.jobs
      .filter((job) => !job.__isSeen)
      .map((job) => job.ciphertext)

    setUnseenIds((previousIds) => {
      const validPrevious = previousIds.filter((id) =>
        unseenJobIds.includes(id)
      )
      return Array.from(new Set([...validPrevious, ...unseenJobIds]))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsHash])

  useEffect(() => {
    eventEmitter.emit(Event.UNSEEN_IDS_UPDATED, unseenIds)

    if (storage.globalState.enabled) {
      browser.action.setBadgeText({
        text: unseenIds.length > 0 ? String(unseenIds.length) : '',
      })
      if (unseenIds.length > 0) {
        browser.action.setBadgeBackgroundColor({ color: colors.warning })
      }
    }

    return () => {
      eventEmitter.emit(Event.UNSEEN_IDS_UPDATED, [])
    }
  }, [unseenIds, storage.globalState.enabled])

  return (
    <>
      {alert}

      {extension.debugEnabled && (
        <>
          <Button onClick={() => setDebugError(null)}>Trigger error</Button>
          {debugError.map((error: any) => error)}
        </>
      )}

      {/* Empty State */}
      {!lastCycleError &&
        !unreadAlert &&
        storage.jobs.length === 0 &&
        !alert && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <GirlReading sx={{ fontSize: '12rem' }} />

            <Typography variant="h6" component="h6">
              Sit back and relax
            </Typography>

            <Typography sx={{ mt: 0.5 }} color="textSecondary">
              Extension will notify you when new jobs appear
            </Typography>
          </Box>
        )}

      {/* Main Split-Pane View */}
      {jobs.length > 0 && (
        <Box>
          {/* Status Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
              minHeight: 32,
            }}
          >
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{ fontWeight: 500 }}
            >
              {jobs.length} job{jobs.length === 1 ? '' : 's'}
              {unseenIds.length > 0 && ` • ${unseenIds.length} unread`}
            </Typography>

            {hasUnreadJobs && (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={markAllAsRead}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8125rem',
                  py: 0.25,
                  px: 1.25,
                  borderRadius: 1.5,
                }}
              >
                Mark all as read
              </Button>
            )}
          </Box>

          {/* Desktop Split-Pane Layout */}
          {isDesktop && (
            <Box
              sx={{
                display: 'flex',
                gap: 2.5,
                alignItems: 'flex-start',
              }}
            >
              {/* Left Column (Job Triage List) */}
              <Box
                sx={{
                  width: { md: 380, lg: 420 },
                  flexShrink: 0,
                  maxHeight: 'calc(100vh - 165px)',
                  overflowY: 'auto',
                  pr: 0.5,
                  '&::-webkit-scrollbar': {
                    width: 6,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(128, 128, 128, 0.2)',
                    borderRadius: 3,
                  },
                }}
              >
                {jobs.map((job) => (
                  <JobListItem
                    key={job.ciphertext}
                    job={job}
                    isSelected={selectedJob?.ciphertext === job.ciphertext}
                    isUnseen={unseenIds.includes(job.ciphertext)}
                    onClick={() => handleSelectJob(job)}
                  />
                ))}
              </Box>

              {/* Right Column (Job & Client Dossier Pane) */}
              <Paper
                variant="outlined"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 2,
                  maxHeight: 'calc(100vh - 165px)',
                  overflowY: 'auto',
                  position: 'sticky',
                  top: 75,
                  '&::-webkit-scrollbar': {
                    width: 6,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(128, 128, 128, 0.2)',
                    borderRadius: 3,
                  },
                }}
              >
                {selectedJob ? (
                  <JobDetailPane
                    job={selectedJob}
                    onApply={handleApply}
                    onConnectPriceFetched={handleConnectPriceFetched}
                  />
                ) : (
                  <Box sx={{ p: 6, textAlign: 'center' }}>
                    <Typography color="textSecondary">
                      Select a job from the list to view full details
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          )}

          {/* Mobile / Tablet View */}
          {!isDesktop && (
            <Box>
              {selectedJobId && selectedJob ? (
                <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                  <JobDetailPane
                    job={selectedJob}
                    onApply={handleApply}
                    onBack={() => setSelectedJobId(null)}
                    onConnectPriceFetched={handleConnectPriceFetched}
                  />
                </Paper>
              ) : (
                <Box>
                  {jobs.map((job) => (
                    <JobListItem
                      key={job.ciphertext}
                      job={job}
                      isSelected={false}
                      isUnseen={unseenIds.includes(job.ciphertext)}
                      onClick={() => handleSelectJob(job)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </>
  )
}

export default Home
