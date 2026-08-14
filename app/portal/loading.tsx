import { PageSkeleton } from "@/components/skeletons/page-skeleton"
import { PortalPageContainer } from "@/components/portal/page-container"

export default function PortalLoading() {
  return (
    <PortalPageContainer>
      <PageSkeleton />
    </PortalPageContainer>
  )
}
