Použití BLE v DVBuddy
Revize
1.0 2.0 3.0 4.0 5.0 6.0 7.0 8.0 9.0 10.0 11.0 12.0 13.0 14.0 15.0 16.0 17.0 18.0 17.2.2021 – OH – Základní informace o scénářích pro BLE a jejich řešení
14.11.2022 – JB – Doplněny charakteristiky pro list, čtení souboru a formát.
23.11.2022 – JB – Upraveny charakteristiky pro list, čtení souboru a formát.
15.12.2022 - JB – Upravena charakteristika pro čtení souboru.
19.12.2022 - JB – Upraveny charakteristika pro čtení souboru.
19.01.2023 - JB – Doplněna vlastní charakteristika pro čtení UID „Serial Number String“.
21.11.2023 - JB – Doplněn popis přihlášení/odhlášení k Boat Unit
- Doplněny všechny podporované obecné charakteristiky
06.12.2023 - JB – Upraveny charakteristiky Session_ID a Apperance
14.12.2023 - JB – Upravena charakteristika Device Name
11.01.2024 - JB – Upravena charakteristika Session_ID
26.01.2024 - JB – Doplněna charakteristika pro nastavení LoRaWan regionu
29.01.2024 - JB – Upravena charakteristika pro nastavení LoRaWan regionu
13.02.2024 - JB – Upraveny charakteristika File Listing a File Set Name/Offset
04.06.2024 - JB – Upravena charakteristika Session_ID
24.09.2024 - JB – Upravena charakteristika Format
10.10.2024 - JB – Doplněn AES podpis do charakteristik Session_ID a LoRaWan
– Změna atributů u charakteristik Format, File_Set_Name a ShortName
16.10.2024 - JB – Změna atributů u charakteristiky File System Listing Directory
17.10.2024 - JB – Doplněna charakteristika Boat Registration (místo LoRaRegion a Session_ID)
– Zrušeny charakteristiky LoRa Frequency, LoRa Power, LoRa SF
– Upraven popis přihlášení/odhlášení DU
19.0 17.10.2024 - JB – Upravena obecná charakteristika Serial Number Striga (0x2A25)
– Změněn název DU specific charakteristiky Serial Number String (DBD00003-
ff30-40a5-9ceb-a17358d31999) na DU Device UID String
20.0 22.10.2024 - JB – Upravena charakteristika Boat Registration
21.0 22.0 23.0 12.11.2024 - JB – Změněn název DU specific charakteristiky DU Device UID String
(DBD00003-ff30-40a5-9ceb-a17358d31999) na DU Device UID String (LoRa)
– Doplněna DU specific charakteristika DU Serial Number String
(DBD00001-ff30-40a5-9ceb-a17358d31999)
24.02.2025 - JB – Upravena charakteristika Boat Registration (doplněn index při shodě
ShortName)
25.03.2025 - JB – Doplněna charakteristika DU Server Registration
(DBD00006-ff30-40a5-9ceb-a17358d31999) pro zavedení DU do systému,
– Doplněna charakteristika DU Sensors Settting
(DBD00007-ff30-40a5-9ceb-a17358d31999) pro kalibraci a nastavení senzorů
– Doplněna charakteristika DU Manufacturer Serial Number
(DBD00008-ff30-40a5-9ceb-a17358d31999) pro uložení číslo na štítku
24.0 01.04.2025 - JB – Upraven název charakteristiky (DBD00006-ff30-40a5-9ceb-a17358d31999)
na DU Server Verification/Registration
– Upraven název charakteristiky (DBD00007-ff30-40a5-9ceb-a17358d31999)
na DU Testing pro HW test, kalibraci a nastavení senzorů
Zkratky
BLE – Bluetooth Low Energy
DVB – DVBuddy
DU – Diver Unit – potápěčská jednotka
BU – Boat Unit – lodní jednotka
1. Případy užití BLE
1.1. Párování jednotky a potápěče pomocí smartphone nebo PC (provádí potápěč)
Slouží primárně k registraci nové jednotky do systému.
Potápěč má novou jednotku a potřebuje do ní zadat krátké jméno potápěče.
1.2. Párování jednotky a potápěče pomocí smartphone nebo PC (provádí
zaměstnanec báze)
Báze půjčuje jednotku a potřebuje do ní zadat (změnit) krátké jméno potápěče.
1.3. Přihlášení (Registrace/párování) potápěčské a lodní jednotky před ponorem
Potápěč přepne svou DU do režimu „Na lodi“. V tomto režimu je v DU aktivován Bluetooth a DU
poskytuje své identifikační a aktuální registrační (párovací) údaje.
● unikátní ID
● krátké jméno potápěče
● LoRa parametry (kmitočet, výkon, SF)
● Aktuální Session_ID (párovací údaj k lodní jednotce)
V BU je nejdříve založena tzv. „New Session“ a dále je aktivováno hledání potápěčů (DU)
k registraci (stav Diving). V tomto stavu BU hledá okolní BLE zařízení a pokouší se identifikovat
neregistrované DU jednotky. Pokud je taková nalezena, zobrazí BU výzvu k registraci s DU
jednotkou. Po potvrzení výzvy proběhne registrace (přihlášení) této DU, což znamená vyčtení a
zápis charakteristiky „Boat_Registration“ do DU. Charakteristika „Boat_Registration“ obsahuje
Session_ID, rádiové parametry LoRa kanálu a také režim provozu DU. Lodní jednotka BU si uloží
tuto DU do Session listu se statusem „přihlášen/Diving“. V tento okamžik je tedy DU ve stavu
„Diving“ (na ponoru).
Režim provozu potápěčské jednotky DU se nastavuje v záložce BU Settings/LoRa Region pomocí
přepínače „Easy Dive Mode“. Je možné potom zvolit buď „Standard Dive Mode“ nebo „Easy Dive
Mode“.
Standard Dive Mode Easy Dive Mode - ukončení ponoru nastavením otočného přepínače do polohy
Active.
- ukončení ponoru automaticky po vynoření nebo nastavením
otočného přepínače do polohy Active.
1.4. Zahájení (start) ponoru na BU
Zahájení ponoru na BU je buď automatické (Auto Start Diving ) nebo vynucené (Forced Start
Diving). Režim „Forced Start Diving“ zamezuje falešnému odhlášení DU před ponorem při
nesprávné manipulaci s otočným přepínačem DU. Režim provozu BU se nastavuje v záložce BU
Settings/LoRa Region pomocí přepínače „Forced Start Diving“.
Auto Start Diving - automatické zahájení monitoringu DU po registraci
Forced Start Diving - zahájení monitoringu DU tlačítkem Start v záložce Diving/Table
1.5. Odhlášení potápěčské jednotky po ponoru
V režimu „Standard Dive Mode“ potápěč přepne otočný přepínač na DU do polohy „Na lodi“ a
čeká na odhlášení, které je aktivováno lodní jednotkou BU. V režimu „Easy Dive Mode“ nemusí
potápěč provádět žádnou manipulaci s otočným přepínačem, pokud proběhl ponor (byl po d
vodou). Pokud však ponor neproběhl a chce se odhlásit, tak musí nejdříve nastavit polohu Active
a po změně stavu na BU opět polohu „Na lodi“. Odhlášení potom znamená vyčtení a zápis
charakteristiky „Boat_Registration“, přičemž Session_ID je v potápěčské jednotce vynulováno,
zároveň si lodní jednotka změní status této DU na „odhlášen/na lodi“
1.6. Stahování dat pomocí smartphone nebo počítače
Potápěč přepne svou jednotku do režimu „Na lodi“ nebo je potápěčská jednotka v nabíječce.
Smartphone nebo počítač se pak pokouší nalézt DU s aktivním Bluetooth. Pokud nalezne,
autentizuje se a dále kontroluje přítomnost nových souborů, které případně automaticky stáhne.
Zprávy používané v BLE
1.7. Common Services
Advertisment
Obsahuje Random UID
Identifikace zařízení
0x1800 – Generic Access Service
● Device Name (0x2A00) -
„DVBdiver@ShortName”
Without assigned ShortName it is „DVBdiver”.
With assigned ShortName it is „DVBdiver@ShortName”.
● Apperance (0x2A01) - 0x1440 (Generic Outdoor Sports Activity)
0x1801 – Generic Attribute
● Service Changed (0x2A05)
0x180A – Device Information Service
● Model Number String (0x2A24) -
„DVB Diver Unit“
● Serial Number String (0x2A25) –
„Unique device ID“ (96-bit, 24 hexa characters)
● Firmware Revision String (0x2A26) -
„1.5-V-2023-11-21T14:45:28“
● Hardware Revision String (0x2A27) -
„11a“
● Software Revision String (0x2A28) -
„dvbfw“
● Manufacturer Name String (0x2A29) -
„DVBuddy“
● … a spousta dalších
● https://www.bluetooth.com/specifications/specs/device-information-service-1-1/
0x180F – Battery Service
● 0x2A19 – Battery Level – 0 – 100 %
1.8. DV Buddy Diver Unit Specific Services
DBD00001-ff30-40a5-9ceb-a17358d31999 – DV Buddy Diver Unit Services
DBD00001-ff30-40a5-9ceb-a17358d31999 – DU Serial Number String
Read
char[], max. 24 hexa characters („Unique device ID“ 96-bit)
DBD00002-ff30-40a5-9ceb-a17358d31999 – DU Short Name
Read/Write_AUTHENT
char[], max. 16 Bytes
DBD00003-ff30-40a5-9ceb-a17358d31999 – DU Device UID String (LoRa)
Read
char[], max. 8 Bytes
DBD00004-ff30-40a5-9ceb-a17358d31999 – Pairing Mode
Read/Write
unsigned short int 2 Bytes
DBD00005-ff30-40a5-9ceb-a17358d31999 – Boat Registration
Read/Write
unsigned char 18 Bytes
Byte 0-3: UTC Time
0x00000000 - Unregistered
Byte 4-6: Boat Unit UID
Byte 7: Command (W)
0x00 - Start of Registration of Standard Dive Mode (Enable)
0x01 - End of Registration
0x02 - Start of Registration Easy Dive Mode (Enable)
0xFF - Deny of Registration (Disable)
Byte 8: LoRaWan Region
Byte 9: RF Power, Spreading Factor
Bit 0-3 Real_Power-10 (0 – 10 dBm, 10 – 20 dBm)
Bit 4-7 Spreading Factor
Byte 10-13: Frequency
Byte 14-17: Random Value for Read
SHA3 Sign for Write
Poznámka 1:
Byte:
Pro zabezpečení před falešnými registracemi je použit při zápisu charakteristiky SHA3
podpis. Podpis má délku 4 Byte a generuje se pomocí SHA3 algoritmu z následujících 34
Byte 0-15 dvb_mac_key[0-15]
Byte 16-29 Data 0-13 charakteristiky Boat Registration
Byte 30-33 Random Value získaná při vyčtení charakteristiky Boat
Registration
Random Value je v DU zneplatněno po timeoutu nebo po zápisu charakteristiky.
Pro testovací účely bude použit následující klíč:
dvb_mac_key[16] = { 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 77,
0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};
Poznámka 2:
Při zápisu charakteristiky musí být položky Session_ID, UTC_Time a Boat Unit UID různé
od nuly. Po deregistraci (odhlášení) si DU nastaví položku UTC_Time na hodnotu
0x00000000 (stav odregistrováno).
Poznámka 3:
Standardní nastavení pro jednotlivé regiony je v následující tabulce.
Region 0 EU868 1 US915 2 AU915 3 AS923 4 AS923-2 5 AS923-3 6 AS923-4 7 KR920 8 IN865 9 RU864 Region
Index
MA869 KZ865 Frequency
[MHz]
SF
869,500 20 8
905,700 20 8
917,800 20 8
922,800 16 9
924,400 16 9
917,200 16 9
917,900 16 9
922,900 14 Power
[dBm]
10
866,850 20 8
868,850 16 9
10 869,500 20 8
11 865,500 20 8
-1 No Region
DBD00006-ff30-40a5-9ceb-a17358d31999 – DU Server Verification/Registration
Read/Write
Byte 0-3: Random Value for Write
SHA3 Sign for Read
Poznámka 4:
Pro zabezpečení před falešnými registracemi je použit při čtení charakteristiky SHA3
podpis. Podpis má délku 4 Byte a generuje se pomocí SHA3 algoritmu z následujících 34
Byte:
Byte 0-15 dvb_mac_key[0-15]
Byte 16-27 96-bit Serial Number [0-11]
Byte 28-31 Random Value získaná při zápisu charakteristiky do DU
Random Value je v DU zneplatněno po timeoutu nebo po zápisu charakteristiky.
Pro testovací účely bude použit následující klíč:
dvb_mac_key[16] = { 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 77,
0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF};
Postup ověření je následující:
Nejdříve se vyčte Seriál Number String (96-bit UID) pomocí charakteristiky
DU Serial Number String. V dalším kroku se zapíše do DU Random Value a
následuje vyčtení podpisu, který si Master zkontroluje.
DBD00007-ff30-40a5-9ceb-a17358d31999 – DU Testing
Read/Write
Read:
Write:
Sensors timeouts and calibration values (tbd.)
Byte 0 Command
0x00 – Sensors timeouts setting (tbd.)
0x10 – Start Accelerometer and Gyro Calibration
0x11 – Start Magnetometer Calibration
0x20 – Start Board HW test
DBD00008-ff30-40a5-9ceb-a17358d31999 – DU Manufacturer Serial Number
Read/Write
char[], max. 12 char alfanum string (QR code on the label)
DBD00010-ff30-40a5-9ceb-a17358d31999 – File System Listing Directory (lfs1/)
Read_AUTHENT
Record of filename;filesize;filesign (separeted by semicolons)
Filename - char[], max. 32 ASCII char
Filesize - char[], max. 9 decadic numbers
Filesign - char[], 16 hexa numbers
DBD00011-ff30-40a5-9ceb-a17358d31999 – Set FileName and FileOffset for downloading
Write_AUTHENT
Record of:
FileName;FileOffset; (separeted by semicolons)
FileName - char[], max. 32 ASCII char
FileOffset - char[], max. 9 decadic numbers
Max R transfer is 64 kB, so after this length it is necessary to set current FileOffset.
Offset value 999999999 means, that file was uploaded to the server.
DBD00012-ff30-40a5-9ceb-a17358d31999 – File Read per Block of bytes
Read
unsigned char[], Block of hardware defined chunk of bytes (max.256 Bytes)
Max. transfer length is done by TX_MTU, which is now set to 252 bytes in DU.
A byte is reserved, so only 251 Bytes should be transferred in a command.
After getting valid response in next R command is offset automatically increased in
range of 64 kB.
DBD00013-ff30-40a5-9ceb-a17358d31999 – File System Format
Write_AUTHENT
1.9. SMP Service (mcumgr)
8d53dc1d-1db7-4cd3-868b-8a527460aa84
Firmware images update
Files upload/download
Shell commands (user defined)
3. Technická realizace BLE
TBD
Zdroje a odkazy
● https://www.bluetooth.com/specifications/assigned-numbers/
● GATT Browser – univerzální aplikace pro smartphone
● Bluetooth LE Explorer – aplikace pro windows
● GattTool – aplikace pro linux
Poznámky
potápěči.
● Lodní jednotka by mohla mít také nějaké jméno (Krátký název) – a to zobrazovat zase zpětně
Random Static Address
This specific type of Bluetooth address serves as a popular alternative to Public addresses since
there are no fees involved with using it.
Random Static Addresses can be used in one of two ways:
• It can be assigned and fixed for the lifetime of the device
• It can be changed at bootup
However, it cannot be changed during runtime.
The format of Random Static Addresses looks like this
Random Static Address format (little-endian format)
• 1 and 1 are fixed in the most significant bits (MSB)
• The remaining 46 bits are chosen randomly by the developer/manufacturer
IMPORTANT NOTE: All Bluetooth devices must use one of either type: a Public Address or
a Random Static Address.
The next type of address (Private Address) is optional and is solely used to address privacy
concerns (i.e. device may use one of them in addition to either a Public or Random Static
Address).