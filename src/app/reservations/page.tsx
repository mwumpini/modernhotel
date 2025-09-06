import ReservationsBookingsManager from '../components/ReservationsBookingsManager';
import PageLayout from '../components/PageLayout';

export default function ReservationsPage() {
  return (
    <PageLayout>
      <div className="px-6 py-6">
        <div className="max-w-[1800px] mx-auto">
          <ReservationsBookingsManager />
        </div>
      </div>
    </PageLayout>
  );
}
