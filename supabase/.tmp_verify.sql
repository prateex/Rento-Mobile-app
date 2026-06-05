select count(*) as missing_booking_no from bookings where booking_number is null;
select count(*) as duplicate_booking_no from (
  select booking_number, count(*) from bookings group by 1 having count(*)>1
) t;
select count(*) as missing_invoice_no from bookings where invoice_number is null;
select count(*) as duplicate_invoice_no from (
  select invoice_number, count(*) from bookings where invoice_number is not null group by 1 having count(*)>1
) t;
select enum_range(null::booking_status) as booking_status_values;
select booking_number, invoice_number, invoice_generated_at from bookings limit 5;
