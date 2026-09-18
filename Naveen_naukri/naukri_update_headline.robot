*** Settings ***
Documentation     A script to login to Naukri, navigate to profile, and update resume headline.
Library           SeleniumLibrary

*** Variables ***
${LOGIN_URL}      https://www.naukri.com/nlogin/login
${USERNAME}       your_username
${PASSWORD}       your_password
${NEW_HEADLINE}   Software Engineer | Python | Robot Framework | Automation
${BROWSER}        Chrome

*** Test Cases ***
Update Naukri Resume Headline
    Open Naukri Login Page
    Login To Naukri
    Navigate To Profile
    Update Resume Headline
    [Teardown]    Close Browser

*** Keywords ***
Open Naukri Login Page
    Open Browser    ${LOGIN_URL}    ${BROWSER}
    Maximize Browser Window
    Wait Until Page Contains Element    id=usernameField    timeout=10s

Login To Naukri
    Input Text    id=usernameField    ${USERNAME}
    Input Password    id=passwordField    ${PASSWORD}
    Click Button    xpath=//button[contains(text(), 'Login')]
    Wait Until Page Contains Element    xpath=//div[contains(@class, 'user-name')]    timeout=15s

Navigate To Profile
    Click Element    xpath=//a[contains(@href, '/mnjuser/profile')]
    Wait Until Page Contains Element    xpath=//span[text()='Resume Headline']    timeout=10s

Update Resume Headline
    # Click the edit button for resume headline
    Click Element    xpath=//span[text()='Resume Headline']/following-sibling::span[contains(@class, 'edit')]
    Wait Until Page Contains Element    id=resumeHeadlineTxt    timeout=5s

    # Clear and update the headline
    Clear Element Text    id=resumeHeadlineTxt
    Input Text    id=resumeHeadlineTxt    ${NEW_HEADLINE}

    # Save changes
    Click Button    xpath=//form[@name='resumeHeadlineForm']//button[text()='Save']

    # Verify success message or modal closure
    Wait Until Page Does Not Contain Element    id=resumeHeadlineTxt    timeout=5s
