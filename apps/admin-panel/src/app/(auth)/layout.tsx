import Background from "@/components/Background"

const AuthLayout = ({ children }: LayoutProps<"/">) => {
    return (
        <Background>
            {children}
        </Background>
    )
}
export default AuthLayout