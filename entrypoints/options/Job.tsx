import {
  Box,
  Link,
  Tooltip,
  ListItem,
  useTheme,
  Typography,
  ListItemText,
} from '@mui/material'
import { useState } from 'react'
import moment from 'moment/moment'
import Handshake from '@/icons/Handshake'
import upworkApi from '@/api/upwork'
import Toggle from '@/components/Toggle'
import JobCard, { unreadStyles, Props as JobCardProps } from './JobCard'

type Props = JobCardProps & {
  detailed: boolean
  onJobRead?: (job: JobCardProps['job']) => void
}

const Job = (props: Props) => {
  const theme = useTheme()
  const [opened, setOpened] = useState(false)

  const handleToggle = () => {
    const nextOpened = !opened
    setOpened(nextOpened)
    if (nextOpened && props.unseen) {
      props.onJobRead?.(props.job)
    }
  }

  if (props.detailed) {
    return (
      <JobCard
        job={props.job}
        unseen={props.unseen}
        onJobClick={props.onJobClick}
      />
    )
  }

  if (opened) {
    return (
      <JobCard
        expanded
        job={props.job}
        unseen={props.unseen}
        onJobClick={props.onJobClick}
        onCollapse={() => setOpened(false)}
      />
    )
  }

  return (
    <ListItem
      sx={{ py: 10 / 8, px: 12 / 8, ...unreadStyles(theme, props.unseen) }}
    >
      <ListItemText
        primary={
          <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
            <Toggle opened={opened} onChange={handleToggle} />

            {props.job.clientRelation && (
              <Tooltip arrow title="Previous client">
                <Handshake color="info" fontSize="large" />
              </Tooltip>
            )}

            <Typography
              variant="h6"
              target="_blank"
              component={Link}
              onClick={(e) => {
                e.preventDefault()
                props.onJobClick(props.job)
              }}
              rel="noopener noreferrer"
              href={upworkApi.viewUrl(props.job.ciphertext)}
              sx={{
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              <span dangerouslySetInnerHTML={{ __html: props.job.title }} />{' '}
              <Typography
                component="span"
                color="textSecondary"
                sx={{ whiteSpace: 'nowrap' }}
              >
                ({moment(props.job.createdOn).fromNow()})
              </Typography>
            </Typography>
          </Box>
        }
      />
    </ListItem>
  )
}

export default Job
