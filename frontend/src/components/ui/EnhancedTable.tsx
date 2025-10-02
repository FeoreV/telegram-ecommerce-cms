import React, { useState, useMemo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Checkbox,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Box,
  Chip,
  Typography,
  Toolbar,
  Tooltip,
} from '@mui/material'
import {
  FilterList,
  Search,
  MoreVert,
  GetApp,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import { visuallyHidden } from '@mui/utils'

export interface Column<T = any> {
  id: keyof T
  label: string
  minWidth?: number
  align?: 'right' | 'left' | 'center'
  format?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  filterable?: boolean
  searchable?: boolean
  hidden?: boolean
}

interface EnhancedTableProps<T> {
  columns: Column<T>[]
  data: T[]
  title?: string
  loading?: boolean
  selectable?: boolean
  searchable?: boolean
  filterable?: boolean
  exportable?: boolean
  rowsPerPageOptions?: number[]
  defaultRowsPerPage?: number
  onRowClick?: (row: T) => void
  onSelectionChange?: (selected: T[]) => void
  onExport?: () => void
  dense?: boolean
  stickyHeader?: boolean
}

type Order = 'asc' | 'desc'

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1
  if (b[orderBy] > a[orderBy]) return 1
  return 0
}

function getComparator<T>(order: Order, orderBy: keyof T) {
  return order === 'desc'
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy)
}

function stableSort<T>(array: T[], comparator: (a: T, b: T) => number) {
  const stabilizedThis = array.map((el, index) => [el, index] as [T, number])
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0])
    if (order !== 0) return order
    return a[1] - b[1]
  })
  return stabilizedThis.map((el) => el[0])
}

function EnhancedTable<T extends Record<string, any>>({
  columns,
  data,
  title,
  loading = false,
  selectable = false,
  searchable = true,
  filterable = true,
  exportable = false,
  rowsPerPageOptions = [5, 10, 25, 50],
  defaultRowsPerPage = 10,
  onRowClick,
  onSelectionChange,
  onExport,
  dense = false,
  stickyHeader = true,
}: EnhancedTableProps<T>) {
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof T>(columns[0]?.id)
  const [selected, setSelected] = useState<T[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage)
  const [searchTerm, setSearchTerm] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof T>>(
    new Set(columns.filter(col => !col.hidden).map(col => col.id))
  )
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleRequestSort = (property: keyof T) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(filteredData)
      onSelectionChange?.(filteredData)
    } else {
      setSelected([])
      onSelectionChange?.([])
    }
  }

  const handleClick = (row: T) => {
    if (selectable) {
      const selectedIndex = selected.findIndex(item => 
        JSON.stringify(item) === JSON.stringify(row)
      )
      let newSelected: T[] = []

      if (selectedIndex === -1) {
        newSelected = newSelected.concat(selected, row)
      } else if (selectedIndex === 0) {
        newSelected = newSelected.concat(selected.slice(1))
      } else if (selectedIndex === selected.length - 1) {
        newSelected = newSelected.concat(selected.slice(0, -1))
      } else if (selectedIndex > 0) {
        newSelected = newSelected.concat(
          selected.slice(0, selectedIndex),
          selected.slice(selectedIndex + 1)
        )
      }

      setSelected(newSelected)
      onSelectionChange?.(newSelected)
    }
    
    onRowClick?.(row)
  }

  const isSelected = (row: T) => 
    selected.some(item => JSON.stringify(item) === JSON.stringify(row))

  const filteredData = useMemo(() => {
    let filtered = data

    // Apply search filter
    if (searchTerm) {
      const searchableColumns = columns.filter(col => col.searchable !== false)
      filtered = filtered.filter(row =>
        searchableColumns.some(col => {
          const value = row[col.id]
          return value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        })
      )
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(row => {
          const value = row[columnId as keyof T]
          return value?.toString().toLowerCase().includes(filterValue.toLowerCase())
        })
      }
    })

    return filtered
  }, [data, searchTerm, columnFilters, columns])

  const sortedData = useMemo(() => {
    return stableSort(filteredData, getComparator(order, orderBy))
  }, [filteredData, order, orderBy])

  const paginatedData = useMemo(() => {
    return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  }, [sortedData, page, rowsPerPage])

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const toggleColumnVisibility = (columnId: keyof T) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId)
    } else {
      newVisible.add(columnId)
    }
    setVisibleColumns(newVisible)
  }

  const visibleColumnsArray = columns.filter(col => visibleColumns.has(col.id))

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {(title || searchable || filterable || exportable) && (
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
          <Typography sx={{ flex: '1 1 100%' }} variant="h6" component="div">
            {title}
          </Typography>

          {searchable && (
            <TextField
              size="small"
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ mr: 2, minWidth: 200 }}
            />
          )}

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVert />
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {exportable && (
              <MenuItem onClick={() => { onExport?.(); setAnchorEl(null) }}>
                <GetApp sx={{ mr: 1 }} />
                Экспорт
              </MenuItem>
            )}
            <MenuItem>
              <Typography variant="subtitle2">Показать колонки:</Typography>
            </MenuItem>
            {columns.map((column) => (
              <MenuItem 
                key={String(column.id)}
                onClick={() => toggleColumnVisibility(column.id)}
              >
                {visibleColumns.has(column.id) ? <Visibility sx={{ mr: 1 }} /> : <VisibilityOff sx={{ mr: 1 }} />}
                {column.label}
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      )}

      <TableContainer sx={{ maxHeight: 440 }}>
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < filteredData.length}
                    checked={filteredData.length > 0 && selected.length === filteredData.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {visibleColumnsArray.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                      {orderBy === column.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => {
              const isItemSelected = isSelected(row)
              const labelId = `enhanced-table-checkbox-${index}`

              return (
                <TableRow
                  hover
                  onClick={() => handleClick(row)}
                  role="checkbox"
                  aria-checked={isItemSelected}
                  tabIndex={-1}
                  key={index}
                  selected={isItemSelected}
                  sx={{ cursor: selectable || onRowClick ? 'pointer' : 'default' }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{ 'aria-labelledby': labelId }}
                      />
                    </TableCell>
                  )}
                  {visibleColumnsArray.map((column) => {
                    const value = row[column.id]
                    return (
                      <TableCell key={String(column.id)} align={column.align}>
                        {column.format ? column.format(value, row) : value}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={filteredData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Строк на странице:"
        labelDisplayedRows={({ from, to, count }) => 
          `${from}–${to} из ${count !== -1 ? count : `более ${to}`}`
        }
      />
    </Paper>
  )
}

export default EnhancedTable
