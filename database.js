const sqliteConfig = {
    locateFile: filename => `sql.js_1.13/dist/${filename}` // sql-wasm.wasm
};
const currency = '₹';       // TODO: use currency column fetched in query instead of hardcoding
const amountColours = {Income: 'blue', Expense: 'red', Transfer: 'black'};

async function sqliteDatabase(file) {
    const buf = await file.arrayBuffer();
    return new SQL.Database(new Uint8Array(buf));
}

function dbQueryResultToRows({columns, values}) {
    return values.map(row => Object.fromEntries(zip(columns, row)));
}

/** Render database query results as a table. 
 * 
 * @param {array} contents - Array of one or more fetched query table results. Each table object has columns and row values.
                    Format example: [{columns:['col1','col2',...], values:[[first row array], [second row array], ...]}]
 * @returns {string} - HTML of result table.
*/
function dbQueryResultsToTables(contents) {
    let ans = '';
    for (const {columns, values} of contents) {
        ans += '<table>';
        ans += '<thead><tr>' + columns.map(escapeHtml).map(cell => `<th>${cell}</th>`).join('') + '</tr></thead>';  // table header
        ans += '<tbody>';
        for (const row of values) {
            ans += '<tr>' + row.map(escapeHtml).map(cell => `<td>${cell}</td>`).join('') + '</tr>';   // table query result rows
        }
        ans += '</tbody>';
        ans += '</table>';
    }
    return ans;
}

async function initDatabase(file) {
    const today = new Date();
    const db = await sqliteDatabase(file);
    new Transactions().displayDailyTab(db, today.getMonth() + 1, today.getFullYear());
}

async function main() {
    window.SQL = await initSqlJs(sqliteConfig);
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "") {
        await initDatabase(await fetch("MMAuto[GF260112](12-01-26-090617).mmbak"));
    }
}


class Transactions {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#date-time_component_options
    static dateFormat = new Intl.DateTimeFormat("en-IN", {day:"2-digit", month:"2-digit", year:"numeric", weekday:"short"});  // example: Wed, 31/12/2000
    // Other useful datetime options:
    // hourCycle: "h24"       // "h11" | "h12" | "h23" | "h24"
    // hour: "2-digit"        // "numeric" | "2-digit"
    // minute: "2-digit"      // "numeric" | "2-digit"

    constructor() {
        this.elem = document.getElementById('transactions');
    }

    /** SQL query to fetch all transactions in given month, date.
     * 
     * @param {number} monthNumber - 1-based month number in year.
     * @param {number} year - Year number (eg. 2026).
     * @returns {string} - SQL query for Sqlite database.
     */
    static sqlQueryDailyTab(monthNumber, year) {
        const monthNumStr = new String(monthNumber).padStart(2,'0');  // eg. '01' for January
        return `
            select datetime(t.UTIME / 1000, 'unixepoch') as dt,
                case
                        when t.ctgUid is null then 'Transfer'
                        when t.ctgUid like '-%' or subcategory.TYPE = 1 then 'Expense'   -- (Modified Balance) ctgUid negative (seems to be -4 only)
                        when subcategory.TYPE = 0 then 'Income' 
                end as type,
                case 
                        when t.ctgUid is null then 'Transfer'
                        when t.ctgUid like '-%' then 'Modified Balance'    -- ctgUid negative (seems to be -4 only)
                        when category.NAME is null then subcategory.NAME 
                        else category.NAME
                    end as category,
                    case
                        when category.NAME is null then null
                        else subcategory.NAME
                    end as subcategory,
                    c.SYMBOL as currency,
                    t.AMOUNT_ACCOUNT as amount,
                    case
                        when t.ctgUid is null then printf('%s -> %s', assets.NIC_NAME, toAssets.NIC_NAME)
                        else assets.NIC_NAME 
                    end as asset,
                    t.ZCONTENT as name, 
                    t.ZDATA as description
            from INOUTCOME t
            left join ZCATEGORY subcategory on subcategory.uid = t.ctgUid
            left join ZCATEGORY category on category.uid = subcategory.pUid
            join assets on assets.uid = t.assetUid
            left join ASSETS toAssets on toAssets.uid = t.toAssetUid
            join CURRENCY c on c.uid = t.currencyUid
            where t.IS_DEL = 0         -- not deleted
                and t.DO_TYPE != 4   -- not Transfer (from) [because its> duplicate Transfer (to) entry is already present]
                and t.ctgUid != ''   -- exclude Modified Balance entries where selected not to save as income/expense
                and t.WDATE like '${year}-${monthNumStr}-%'
            order by t.UTIME desc
        `;
    }

    /** Display all transactions in given month, date.
     * 
     * @param {number} monthNumber - 1-based month number in year.
     * @param {number} year - Year number (eg. 2026).
     */
    displayDailyTab(db, monthNumber, year) {
        const amountTableCell = (type, amount) => `<td style="color: ${amountColours[type]}">${currency} ${amount.toFixed(2)}</td>`;
        const query = Transactions.sqlQueryDailyTab(monthNumber, year);
        const queryTable = db.exec(query)[0];
        const rows = dbQueryResultToRows(queryTable);    // [0] since single query result table only

        // add property formattedDate, to be used for display and sorting
        for (const row of rows) row.formattedDate = Transactions.dateFormat.format(new Date(row.dt));

        let ans = '<table>';
        for (let [dateString, dateRows] of groupByInSortedArray(rows, r => r.formattedDate)) {
            // total expenses & income for current date
            const dateExpenses = sum(dateRows.filter(r => r.type == "Expense").map(r => r.amount));
            const dateIncome = sum(dateRows.filter(r => r.type == "Income").map(r => r.amount));

            ans += '<tbody>';
            ans += `
                <tr class="transaction-date"> 
                    <td>${dateString}</td> 
                    ${amountTableCell("Income", dateIncome)}
                    ${amountTableCell("Expense", dateExpenses)}
                </tr>
            `;
            for (const row of dateRows) {
                ans += `
                    <tr class="transaction-head"> 
                        <td rowspan="${row.subcategory === null ? 2 : 1}">${row.category}</td> 
                        ${row.name === '' ? `<td rowspan="2">${row.asset}</td>` : `<td style="color: black">${row.name}</td>` } 
                        ${amountTableCell(row.type, row.amount)}
                    </tr>
                    <tr class="transaction-foot"> 
                        ${row.subcategory === null ? '' : `<td style="font-size: smaller">${row.subcategory}</td>`} 
                        ${row.name === '' ? '' : `<td>${row.asset}</td>`} 
                        <td></td> 
                    </tr>
                `;
            }
            ans += `</tbody>`;
        }
        ans += '</table>';
        this.elem.innerHTML = ans;
    }
}