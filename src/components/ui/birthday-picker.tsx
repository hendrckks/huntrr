"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

interface BirthdayPickerProps {
  onSelect: (date: Date | undefined) => void
}

export function BirthdayPicker({ onSelect }: BirthdayPickerProps) {
  const [date, setDate] = React.useState<Date>()
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 100 }, (_, i) => currentYear - i)
  }, [])

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate) {
      setCurrentMonth(selectedDate)
    }
    onSelect(selectedDate)
  }

  const handleYearChange = (selectedYear: string) => {
    const newYear = Number.parseInt(selectedYear, 10)
    const newDate = new Date(newYear, currentMonth.getMonth(), 1)
    setCurrentMonth(newDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn("w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-border">
          <Select onValueChange={handleYearChange} defaultValue={currentMonth.getFullYear().toString()}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          initialFocus
          fromYear={1900}
          toYear={new Date().getFullYear()}
        />
      </PopoverContent>
    </Popover>
  )
}