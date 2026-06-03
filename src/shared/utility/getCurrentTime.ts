const GET_CURRENT_TIME = (targetTimezone = 'Asia/Kolkata') => {
  // Create a date object for the current time
  const now = new Date();

  // Create an Intl.DateTimeFormat object for the target timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: targetTimezone,
    weekday: 'long', // Full day name (e.g., "Monday")
    hour: 'numeric', // Numeric hour (e.g., 1, 2, 3, ...)
    minute: 'numeric', // Numeric minute (e.g., 01, 02, 03, ...)
    second: 'numeric', // Numeric second (e.g., 01, 02, 03, ...)
    year: 'numeric',
    month: '2-digit', // '2-digit' ensures a leading zero for single-digit months
    day: '2-digit', // '2-digit' ensures a leading zero for single-digit days
    hourCycle: 'h24',
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);

  // Format the current time in the target timezone
  const formattedDate = formatter.format(now);
  const split = formattedDate.split(', ');
  return { day: split[0], date: split[1], time: split[2] };
};

export default GET_CURRENT_TIME;
